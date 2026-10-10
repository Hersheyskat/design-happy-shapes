import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Heart, ImagePlus, Instagram, Link as LinkIcon, LoaderCircle, MessageCircle, Share2, ShoppingBag, Sparkles, Upload, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { ShopLookShell } from "@/components/shoplook-shell";
import { ShopLookResult } from "@/components/shoplook-result";
import { supabase } from "@/integrations/supabase/client";
import { ensureLookShareSlug, listCatalogProducts, saveMyLook } from "@/lib/community.functions";
import type { CatalogProductDto } from "@/lib/community.types";
import { recordShopperEvent } from "@/lib/shopper-events.functions";
import { analyseGeneratedLook } from "@/lib/stylist-comment.functions";
type Product = CatalogProductDto;
type PendingAction = { type: "generate" | "favorite" | "share" | "shareComparison" | "buy"; productId: string };

export const Route = createFileRoute("/")({
  validateSearch: (search) => z.object({ product: z.string().optional(), mood: z.string().optional() }).catch({}).parse(search),
  head: () => ({ meta: [
    { title: "Shop your look — ShopLook" },
    { name: "description", content: "Upload your photo, explore apparel on your look, compare favorites, share and shop." },
    { property: "og:title", content: "Shop your look — ShopLook" },
    { property: "og:description", content: "Explore apparel on your photo, compare favorites, share and shop." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ShopLook,
});

function shopUrl(product: Product) {
  return product.productUrl;
}

function productMeta(product: Product) {
  return {
    product_name: product.name,
    retailer: product.retailer,
    audience: product.audience,
    price: product.price,
    currency: product.currency,
    product_url: product.productUrl,
  };
}

function productBrand(name: string) {
  const brands = [
    "Symbol Premium", "SMOWKLY", "DEELMO", "INKAST", "AD by Arvind", "BASICS", "Thomas Scott",
    "FableStreet", "SaintX", "Cottinfab", "U.S. Polo ASSN.", "ROCKSY", "KLOSIA", "Stylum", "Myx",
    "Calvin Klein", "CK", "Louis Philippe", "USPA", "Levi's", "SHEIN", "Moomaya",
  ];
  const withoutRetailerPrefix = name.replace(/^Amazon Brand\s*[-–]\s*/i, "");
  return brands.find((brand) => withoutRetailerPrefix.toLowerCase().startsWith(brand.toLowerCase())) ?? "Brand not listed";
}

function PreviewPhoto({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="relative size-full overflow-hidden bg-surface">
    {!loaded && !failed && <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Loading image"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>}
    {failed ? <div className="flex size-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Image unavailable</div> : <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`size-full object-cover ${loaded ? "" : "invisible"}`} />}
  </div>;
}

function LookImage({ person, product, generated, comparison = false, hero = false }: { person: string; product: Product; generated?: string | undefined; comparison?: boolean; hero?: boolean }) {
  const [generatedFailed, setGeneratedFailed] = useState(false);
  useEffect(() => setGeneratedFailed(false), [generated]);
  const showGenerated = Boolean(generated && !generatedFailed);
  return <div className={`relative w-full overflow-hidden bg-surface ${hero ? "h-[clamp(260px,48dvh,600px)]" : "aspect-[2/3]"}`}>
    {showGenerated && generated ? <div className="size-full"><img src={generated} alt={`AI visualization of you wearing ${product.name}`} onError={() => setGeneratedFailed(true)} className={`size-full ${hero ? "object-contain" : "object-cover"} ${comparison && product.id === "teal" ? "scale-125" : ""}`} /></div> : <PreviewPhoto key={person} src={person} alt="Your original photo — no outfit has been generated yet" />}
    {!showGenerated && <span className="absolute bottom-3 left-3 rounded bg-overlay px-2.5 py-1 text-[10px] font-semibold text-overlay-foreground">Your original photo</span>}
    {generatedFailed && <span role="alert" className="absolute right-3 top-3 rounded bg-overlay px-2 py-1 text-xs text-overlay-foreground">AI image unavailable · showing your photo</span>}
  </div>;
}

function ShopLook() {
  const { product: selectedProductId } = Route.useSearch();
  const loadCatalog = useServerFn(listCatalogProducts);
  const requestStylistComment = useServerFn(analyseGeneratedLook);
  const persistLook = useServerFn(saveMyLook);
  const ensureShareSlug = useServerFn(ensureLookShareSlug);
  const trackEvent = useServerFn(recordShopperEvent);
  const [products, setProducts] = useState<Product[]>([]);
  const [audience, setAudience] = useState<"men" | "women" | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogReady, setCatalogReady] = useState(false);
  const catalogRequested = useRef(false);
  useEffect(() => {
    if (catalogRequested.current) return;
    catalogRequested.current = true;
    void loadCatalog().then(setProducts).catch(() => setCatalogError("Could not load products. Please reload to try again.")).finally(() => setCatalogReady(true));
  }, [loadCatalog]);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  useEffect(() => { if (selectedProduct) setAudience(selectedProduct.audience); }, [selectedProduct]);
  const visibleProducts = products.filter((product) => product.audience === audience).sort((left, right) => left.id === selectedProductId ? -1 : right.id === selectedProductId ? 1 : 0);
  const firstProduct = visibleProducts[0];
  const [view, setView] = useState<"start" | "try" | "compare">("start");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [stylistComments, setStylistComments] = useState<Record<string, string>>({});
  const [stylistLoading, setStylistLoading] = useState<string | null>(null);
  const [stylistErrors, setStylistErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shareId, setShareId] = useState<string | null>(null);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [sharingComparison, setSharingComparison] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const savingIdsRef = useRef(new Set<string>());
  const stylistRequestsRef = useRef(new Map<string, Promise<string | null>>());
  const [savedLooks, setSavedLooks] = useState<Record<string, { id: string; shareSlug: string }>>({});
  const [photoChoiceOpen, setPhotoChoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<{ file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const person = photo ?? "";
  const active = products.find((product) => product.id === activeId) ?? firstProduct;
  const shareProduct = products.find((product) => product.id === shareId);
  const shopProduct = products.find((product) => product.id === shopId);
  const comparison = favorites.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product && generated[product.id]));

  useEffect(() => () => { if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2_000);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);
  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream]);

  function applyPhoto(file: File, url: string) {
    setAudience(null);
    setError(""); setPhoto(url); setPhotoFile(file); setGenerated({}); setStylistComments({}); setStylistErrors({}); setFavorites([]); setSavedLooks({}); setGenerationError("");
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      setError("Choose a JPG, PNG or WebP photo under 8 MB."); event.target.value = ""; return;
    }
    applyPhoto(file, URL.createObjectURL(file));
    event.target.value = "";
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }

  function closeCamera() {
    stopCamera();
    if (capturedSelfie) URL.revokeObjectURL(capturedSelfie.url);
    setCapturedSelfie(null); setCameraOpen(false); setCameraError("");
  }

  async function startCamera() {
    setPhotoChoiceOpen(false); setCameraOpen(true); setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("A camera is not available in this browser. You can upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCameraStream(stream);
    } catch {
      setCameraError("Camera access was not allowed. You can upload a photo instead.");
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `shoplook-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCapturedSelfie({ file, url: URL.createObjectURL(blob) });
      stopCamera();
    }, "image/jpeg", 0.9);
  }

  async function retakeSelfie() {
    if (capturedSelfie) URL.revokeObjectURL(capturedSelfie.url);
    setCapturedSelfie(null); setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCameraStream(stream);
    } catch {
      setCameraError("Camera access was not allowed. You can upload a photo instead.");
    }
  }

  function useSelfie() {
    if (!capturedSelfie) return;
    applyPhoto(capturedSelfie.file, capturedSelfie.url);
    setCapturedSelfie(null); setCameraOpen(false); setCameraError("");
  }

  function chooseAudience(next: "men" | "women") {
    setAudience(next); setActiveId("");
  }

  function applyFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function requireSignIn(action: PendingAction) {
    const { data } = await supabase.auth.getUser();
    if (data.user) return true;
    setPendingAction(action);
    setAuthOpen(true);
    return false;
  }

  async function favoriteLook(product: Product) {
    if (favorites.includes(product.id)) {
      applyFavorite(product.id);
      return;
    }
    if (!await requireSignIn({ type: "favorite", productId: product.id })) return;
    if (savedLooks[product.id]) {
      applyFavorite(product.id);
      return;
    }
    if (await saveLook(product)) applyFavorite(product.id);
  }

  function track(eventType: "buy_click" | "share_click", product: Product, channel: string) {
    void trackEvent({ data: { eventType, catalogProductId: product.id, channel, metadata: productMeta(product) } }).catch(() => {});
  }

  function lookShareUrl(productId: string) {
    const slug = savedLooks[productId]?.shareSlug;
    return slug ? `${window.location.origin}/l/${slug}` : null;
  }

  async function ensureSharedLook(product: Product) {
    const existing = savedLooks[product.id];
    if (existing?.shareSlug) return existing;
    if (existing?.id) {
      const ensured = await ensureShareSlug({ data: { id: existing.id } });
      const next = { id: ensured.id, shareSlug: ensured.shareSlug };
      setSavedLooks((current) => ({ ...current, [product.id]: next }));
      return next;
    }
    return await saveLook(product, { indicateSaving: false });
  }

  async function openShare(product: Product) {
    if (!await requireSignIn({ type: "share", productId: product.id })) return;
    setMessage("");
    setSharingComparison(false);
    setSharePreparing(true);
    try {
      const saved = await ensureSharedLook(product);
      if (!saved) return;
      setShareId(product.id);
      track("share_click", product, "button");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "This look could not get a share link.");
    } finally {
      setSharePreparing(false);
    }
  }

  async function openComparisonShare() {
    const first = comparison[0];
    if (!first || !await requireSignIn({ type: "shareComparison", productId: first.id })) return;
    setMessage("");
    setSharingComparison(true);
    setShareId(first.id);
  }

  async function openShop(product: Product) {
    if (!await requireSignIn({ type: "buy", productId: product.id })) return;
    setShopId(product.id);
  }

  function continueToShop(product: Product) {
    track("buy_click", product, "retailer");
    setShopId(null);
    window.open(shopUrl(product), "_blank", "noopener,noreferrer");
  }

  async function saveLook(product: Product, options?: { indicateSaving?: boolean }): Promise<{ id: string; shareSlug: string } | null> {
    const indicateSaving = options?.indicateSaving ?? true;
    const generatedImage = generated[product.id];
    if (!generatedImage || savingIdsRef.current.has(product.id)) return null;
    if (savedLooks[product.id]?.shareSlug) return savedLooks[product.id]!;
    savingIdsRef.current.add(product.id);
    if (indicateSaving) {
      setSavingIds((current) => [...current, product.id]);
      setMessage("");
    }
    const uploadedPaths: string[] = [];
    try {
      const stylistComment = stylistComments[product.id] ?? await stylistRequestsRef.current.get(product.id) ?? "A stylist note was not available for this look.";
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Please sign in again to save this look.");
      const folder = `${userData.user.id}/looks/${crypto.randomUUID()}`;
      const lookBlob = await (await fetch(generatedImage)).blob();
      const lookPath = `${folder}/shoplook.${lookBlob.type === "image/webp" ? "webp" : "png"}`;
      const lookUpload = await supabase.storage.from("shoplook-media").upload(lookPath, lookBlob, { contentType: lookBlob.type || "image/png" });
      if (lookUpload.error) throw lookUpload.error;
      uploadedPaths.push(lookPath);

      let productPath: string | null = null;
      const productResponse = await fetch(product.image);
      if (productResponse.ok) {
        const productBlob = await productResponse.blob();
        if (productBlob.type.startsWith("image/")) {
          productPath = `${folder}/product.${productBlob.type === "image/webp" ? "webp" : "jpg"}`;
          const productUpload = await supabase.storage.from("shoplook-media").upload(productPath, productBlob, { contentType: productBlob.type || "image/jpeg" });
          if (productUpload.error) throw productUpload.error;
          uploadedPaths.push(productPath);
        }
      }

      const saved = await persistLook({ data: {
        shopperImagePath: lookPath,
        productImagePath: productPath,
        productUrl: product.productUrl,
        catalogProductId: product.id,
        styleNote: "",
        mood: "classic",
        stylistComment,
      } });
      const next = { id: saved.id, shareSlug: saved.shareSlug };
      setSavedLooks((current) => ({ ...current, [product.id]: next }));
      if (indicateSaving) setMessage("Saved privately to your Saved looks.");
      return next;
    } catch (reason) {
      if (uploadedPaths.length) await supabase.storage.from("shoplook-media").remove(uploadedPaths);
      setMessage(reason instanceof Error ? reason.message : "This look could not be saved. Please try again.");
      return null;
    } finally {
      savingIdsRef.current.delete(product.id);
      if (indicateSaving) setSavingIds((current) => current.filter((id) => id !== product.id));
    }
  }

  function selectProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product || generating) return;
    setGenerationError("");
    if (generated[id]) setActiveId(id);
    else void generateLook(product);
  }

  async function generateLook(product: Product) {
    if (generating || !photoFile) return;
    await supabase.auth.getUser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    setGenerating(product.id); setGenerationError("");
    try {
      const garmentBlob = await (await fetch(product.image)).blob();
      const garment = new File([garmentBlob], `${product.id}.${garmentBlob.type === "image/webp" ? "webp" : "jpg"}`, { type: garmentBlob.type });
      const form = new FormData();
      form.append("person", photoFile); form.append("garment", garment); form.append("note", "");
      form.append("catalogProductId", product.id); form.append("productName", product.name); form.append("retailer", product.retailer); form.append("audience", product.audience); form.append("price", String(product.price));
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch("/api/generate-look", { method: "POST", headers, body: form });
      const result = await response.json().catch(() => ({})) as { image?: string; message?: string; code?: string };
      if (response.status === 401 && result.code === "login_required" && !token) {
        setPendingAction({ type: "generate", productId: product.id });
        setAuthOpen(true);
        setGenerationError("Sign in to create more looks.");
        return;
      }
      if (!response.ok || !result.image) throw new Error(result.message ?? "OpenRouter could not make this look right now.");
      const nextImage = new Image();
      nextImage.src = result.image;
      await nextImage.decode();
      setGenerated((current) => ({ ...current, [product.id]: result.image as string }));
      setActiveId(product.id);
      setStylistLoading(product.id);
      setStylistErrors((current) => { const next = { ...current }; delete next[product.id]; return next; });
      const stylistRequest = requestStylistComment({ data: { lookImage: result.image, productName: product.name, retailer: product.retailer } })
        .then((review) => {
          if (review.ok) {
            setStylistComments((current) => ({ ...current, [product.id]: review.comment }));
            return review.comment;
          }
          setStylistErrors((current) => ({ ...current, [product.id]: review.error }));
          return null;
        })
        .catch(() => {
          setStylistErrors((current) => ({ ...current, [product.id]: "Your stylist could not review this look right now." }));
          return null;
        })
        .finally(() => setStylistLoading((current) => current === product.id ? null : current));
      stylistRequestsRef.current.set(product.id, stylistRequest);
    } catch (reason) {
      setGenerationError(reason instanceof Error ? reason.message : "Could not make an AI look right now.");
    } finally { setGenerating(null); }
  }

  async function shareImageFile(product: Product) {
    if (!sharingComparison) {
      return new File([await (await fetch(generated[product.id] ?? "")).blob()], `shoplook-${product.id}.png`, { type: "image/png" });
    }
    const images = await Promise.all(comparison.map(async (item) => {
      const image = new Image();
      image.src = generated[item.id] ?? "";
      await image.decode();
      return image;
    }));
    const canvas = document.createElement("canvas");
    canvas.width = images.length * 600;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare your comparison.");
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    images.forEach((image, index) => {
      const scale = Math.min(600 / image.naturalWidth, 900 / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, index * 600 + (600 - width) / 2, (900 - height) / 2, width, height);
    });
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare your comparison.")), "image/png"));
    return new File([blob], "my-shoplook-comparison.png", { type: "image/png" });
  }

  async function shareToInstagram(product: Product) {
    try {
      setMessage("");
      const generatedImage = generated[product.id];
      if (!generatedImage) { setMessage("Generate this look before sharing it."); return; }
      const image = await shareImageFile(product);
      if (navigator.canShare?.({ files: [image] })) {
        await navigator.share({
          files: [image],
          title: sharingComparison ? "Compare my ShopLooks" : `My ShopLook — ${product.name}`,
          text: "My ShopLook",
        });
        setShareId(null);
        track("share_click", product, "instagram");
      } else {
        const link = document.createElement("a");
        const url = URL.createObjectURL(image);
        link.href = url; link.download = image.name; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setShareId(null);
        setMessage("Image downloaded. Open Instagram and choose it from your photos.");
        track("share_click", product, "instagram");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setMessage("Could not open Instagram sharing. Please try again.");
    }
  }

  async function shareToWhatsApp(product: Product) {
    const generatedImage = generated[product.id];
    if (!generatedImage) { setMessage("Generate this look before sharing it."); return; }
    if (sharingComparison) {
      const text = `Help me choose from my ShopLooks: ${window.location.href}`;
      try {
        const image = await shareImageFile(product);
        if (navigator.canShare?.({ files: [image] })) {
          await navigator.share({ files: [image], title: "Compare my ShopLooks", text });
          setShareId(null);
          track("share_click", product, "whatsapp");
          return;
        }
        const link = document.createElement("a");
        const url = URL.createObjectURL(image);
        link.href = url; link.download = image.name; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setMessage("Could not prepare your looks. Please try again.");
        return;
      }
      setShareId(null);
      track("share_click", product, "whatsapp");
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      return;
    }
    const url = lookShareUrl(product.id);
    if (!url) { setMessage("This look could not get a share link."); return; }
    const text = `Check out my ShopLook: ${url}`;
    setShareId(null);
    track("share_click", product, "whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function continuePendingAction() {
    const action = pendingAction;
    if (!action) return;
    const product = products.find((item) => item.id === action.productId);
    if (!product) { setPendingAction(null); return; }
    setPendingAction(null);
    if (action.type === "generate") { setView("try"); void generateLook(product); }
    if (action.type === "favorite") void favoriteLook(product);
    if (action.type === "share") void openShare(product);
    if (action.type === "shareComparison") { setSharingComparison(true); setShareId(product.id); }
    if (action.type === "buy") void openShop(product);
  }

  async function copyLink() {
    if (sharingComparison) {
      try { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied. Your private photo is not included in this link."); }
      catch {
        const input = document.createElement("textarea");
        input.value = window.location.href;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        setMessage(copied ? "Link copied. Your private photo is not included in this link." : "Copying is unavailable in this browser.");
      }
      return;
    }
    if (!shareProduct) return;
    track("share_click", shareProduct, "copy_link");
    const url = lookShareUrl(shareProduct.id);
    if (!url) { setMessage("This look could not get a share link."); return; }
    try { await navigator.clipboard.writeText(url); setMessage("Look link copied."); }
    catch {
      const input = document.createElement("textarea");
      input.value = url;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setMessage(copied ? "Look link copied." : "Copying is unavailable in this browser.");
    }
  }

  function reset() { setAudience(null); setView("start"); setPhoto(null); setPhotoFile(null); setGenerated({}); setStylistComments({}); setStylistErrors({}); setStylistLoading(null); stylistRequestsRef.current.clear(); setGenerationError(""); setFavorites([]); setSavedLooks({}); setActiveId(""); setShareId(null); setSharePreparing(false); setShopId(null); setMessage(""); }

  return <ShopLookShell>
    <header className={`flex h-16 items-center justify-between border-b border-border px-5 ${view === "try" ? "bg-card" : ""}`}>
      {view === "start" ? <span className="w-10" /> : <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => setView(view === "compare" ? "try" : "start")}><ArrowLeft /></Button>}
      <Button variant="ghost" onClick={reset} className="font-display text-2xl font-normal">ShopLook</Button>
      <span className="w-10" />
    </header>

    {view === "start" && <section className="px-5 pb-12 pt-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">AI-Powered Shopping Agent</p>
      <h1 className="mt-3 font-display text-5xl leading-none">Shop your look.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Fashion shopping made personal and fun. Try two looks free, then sign in to keep creating.</p>
      <div className="mt-6 overflow-hidden rounded-md bg-surface">
        <Button type="button" variant="ghost" className="relative aspect-[5/4] h-auto w-full rounded-none p-0" onClick={() => setPhotoChoiceOpen(true)} aria-label={photo ? "Change your photo" : "Add your photo"}>
          {photo ? <img src={photo} alt="Your photo preview" className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface"><span className="grid size-14 place-items-center rounded-full bg-background text-primary"><ImagePlus className="size-6" /></span><span className="font-display text-2xl">Add your photo</span><span className="text-xs text-muted-foreground">Choose a clear picture of yourself</span></div>}
          {photo && <span className="absolute bottom-3 right-3 rounded bg-overlay px-3 py-1.5 text-xs text-overlay-foreground"><Check className="mr-1 inline size-3" /> Photo ready · tap to change</span>}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose your photo" className="sr-only" onChange={upload} />
        <h2 className="mt-5 text-sm font-semibold">Choose one</h2>
        <div className="mt-2 flex gap-2" role="group" aria-label="Explore products"><Button type="button" aria-pressed={audience === "women"} variant={audience === "women" ? "default" : "outline"} onClick={() => chooseAudience("women")}>Woman</Button><Button type="button" aria-pressed={audience === "men"} variant={audience === "men" ? "default" : "outline"} onClick={() => chooseAudience("men")}>Man</Button>{audience && <span className="self-center text-xs text-muted-foreground">{visibleProducts.length} products</span>}</div>
       {audience && catalogReady && !catalogError && visibleProducts.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No products in this catalogue yet.</p>}
       {selectedProduct && selectedProduct.audience === audience && <div className="mt-4 flex items-center gap-3 rounded-md border border-primary bg-surface p-2"><img src={selectedProduct.image} alt="" className="size-14 rounded-sm object-contain" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-primary">First in your Look queue</p><p className="truncate text-sm font-medium">{selectedProduct.name}</p></div></div>}
      {catalogError && <p role="alert" className="mt-3 text-sm text-destructive">{catalogError}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-5 h-12 w-full text-base" disabled={!photo || !firstProduct} onClick={() => { if (!firstProduct) return; setView("try"); void generateLook(firstProduct); }}>Create your ShopLook <Sparkles /></Button>
    </section>}

    {view === "try" && active && <ShopLookResult
      product={active}
      products={visibleProducts}
      image={<LookImage person={person} product={active} generated={generated[active.id]} hero />}
      imageUrl={generated[active.id] ?? person}
      completed={Boolean(generated[active.id])}
      generating={generating}
      saving={savingIds.includes(active.id)}
      sharing={sharePreparing}
      selected={favorites.includes(active.id)}
      canSave={Boolean(generated[active.id]) && generating !== active.id}
      comment={stylistComments[active.id]}
      commentLoading={stylistLoading === active.id}
      commentError={stylistErrors[active.id]}
      generationError={generationError}
      comparisonCount={comparison.length}
      brand={productBrand}
      onShare={() => void openShare(active)}
      onSave={() => void favoriteLook(active)}
      onBuy={() => void openShop(active)}
      onSelect={selectProduct}
      onCompare={() => setView("compare")}
    />}

    {view === "compare" && <section className="px-4 pb-12 pt-6"><p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">The shortlist</p><div className="flex items-center justify-between gap-2"><h1 className="mt-1 px-1 font-display text-4xl">Compare your looks</h1><Button variant="ghost" size="icon" className="shrink-0" aria-label="Share all looks" title="Share all looks" disabled={!comparison.length} onClick={() => void openComparisonShare()}><Share2 /></Button></div><p className="mt-2 px-1 text-sm text-muted-foreground">{comparison.length} favorites · scroll for more</p>
         <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-7">{comparison.map((product) => <article key={product.id} className="min-w-0"><LookImage person={person} product={product} generated={generated[product.id]} comparison /><div className="flex min-h-14 items-center justify-between gap-1 py-2"><div className="min-w-0"><h2 className="truncate font-display text-lg">{productBrand(product.name)}</h2><p className="truncate text-xs text-muted-foreground">{product.retailer} · ₹{product.price.toLocaleString("en-IN")}</p></div><Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${product.name} from comparison`} title="Remove from comparison" onClick={() => void favoriteLook(product)}><Heart className="fill-primary text-primary" /></Button></div><div className="flex items-center justify-center gap-3"><Button className="h-10 w-full text-sm" aria-label={`${product.productUrl ? "Buy" : "Search for"} ${product.name}`} onClick={() => void openShop(product)}><ShoppingBag className="size-4" /> {product.productUrl ? "Buy" : "Search"}</Button></div></article>)}</div>
        {comparison.length === 0 && <div className="py-16 text-center"><Heart className="mx-auto mb-3 size-7 text-primary" /><p className="text-sm text-muted-foreground">Your shortlist is empty. Generate a look and heart it to compare here.</p></div>}
         <Button variant="outline" className="mt-8 h-11 w-full" onClick={() => setView("try")}>Try more apparel</Button><p className="mt-4 text-center text-[11px] text-muted-foreground">AI visualizations are not fit guarantees · retailer links are for discovery · no partnership implied</p>
    </section>}

    {photoChoiceOpen && <div role="dialog" aria-modal="true" aria-label="Add your photo" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoChoiceOpen(false); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Add your photo</h2><Button variant="ghost" size="icon" aria-label="Close photo options" onClick={() => setPhotoChoiceOpen(false)}><X /></Button></div><div className="mt-5 grid gap-2"><Button className="h-12 justify-start" onClick={() => { setPhotoChoiceOpen(false); fileRef.current?.click(); }}><Upload /> Upload your photo</Button><Button variant="outline" className="h-12 justify-start" onClick={() => void startCamera()}><Camera /> Take your selfie</Button></div></div></div>}

    {cameraOpen && <div role="dialog" aria-modal="true" aria-label="Take your selfie" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim"><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Take your selfie</h2><Button variant="ghost" size="icon" aria-label="Cancel selfie" onClick={closeCamera}><X /></Button></div><div className="mt-4 aspect-[3/4] overflow-hidden rounded-md bg-surface">{capturedSelfie ? <img src={capturedSelfie.url} alt="Your captured selfie" className="size-full object-cover" /> : cameraError ? <div className="flex size-full items-center justify-center px-8 text-center text-sm text-muted-foreground">{cameraError}</div> : <video ref={videoRef} autoPlay playsInline muted className="size-full scale-x-[-1] object-cover" />}</div><canvas ref={canvasRef} className="hidden" />{capturedSelfie ? <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={() => void retakeSelfie()}><Camera /> Retake</Button><Button className="h-12" onClick={useSelfie}><Check /> Use photo</Button></div> : cameraError ? <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={closeCamera}>Cancel</Button><Button className="h-12" onClick={() => { closeCamera(); fileRef.current?.click(); }}><Upload /> Upload</Button></div> : <Button className="mt-4 h-12 w-full" onClick={captureSelfie}><Camera /> Capture</Button>}</div></div>}

    {shareProduct && <div role="dialog" aria-modal="true" aria-label={`Share ${shareProduct.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareId(null); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">{sharingComparison ? "Share your looks" : "Share your look"}</h2><Button variant="ghost" size="icon" aria-label="Close share options" onClick={() => setShareId(null)}><X /></Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Share your look with friends on Insta and WhatsApp for feedback &amp; fun :)</p>{!sharingComparison && lookShareUrl(shareProduct.id) && <p className="mt-3 break-all rounded-md bg-surface px-3 py-2 text-[11px] leading-4 text-muted-foreground">{lookShareUrl(shareProduct.id)}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={() => void shareToInstagram(shareProduct)}><Instagram /> Instagram</Button><Button variant="outline" className="h-12" onClick={() => void shareToWhatsApp(shareProduct)}><MessageCircle /> WhatsApp</Button></div><Button variant="outline" className="mt-2 h-12 w-full" onClick={() => void copyLink()}><LinkIcon /> {sharingComparison ? "Copy app link" : "Copy look link"}</Button>{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}</div></div>}
    {shopProduct && <div role="dialog" aria-modal="true" aria-label="Thank you for using ShopLook" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShopId(null); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Thank you</h2><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setShopId(null)}><X /></Button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Thank you for using ShopLook. We&apos;ll take you to the retailer to continue shopping.</p><Button className="mt-5 h-12 w-full" onClick={() => continueToShop(shopProduct)}><ShoppingBag /> Continue to {shopProduct.retailer}</Button><Button variant="outline" className="mt-2 h-11 w-full" onClick={() => setShopId(null)}>Stay on ShopLook</Button></div></div>}
    {message && !shareProduct && !shopProduct && <p role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-sm rounded-md bg-overlay px-4 py-3 text-center text-sm text-overlay-foreground shadow-float">{message}</p>}
    <AuthDialog open={authOpen} onOpenChange={(open) => { setAuthOpen(open); if (!open) setPendingAction(null); }} onSignedIn={continuePendingAction} />
  </ShopLookShell>;
}
