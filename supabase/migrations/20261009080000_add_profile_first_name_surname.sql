ALTER TABLE public.profiles
  ADD COLUMN first_name text NOT NULL DEFAULT '' CHECK (char_length(first_name) <= 30),
  ADD COLUMN surname text NOT NULL DEFAULT '' CHECK (char_length(surname) <= 30);

UPDATE public.profiles
SET
  first_name = left(split_part(btrim(display_name), ' ', 1), 30),
  surname = left(
    CASE
      WHEN position(' ' in btrim(display_name)) > 0 THEN btrim(substring(btrim(display_name) from position(' ' in btrim(display_name)) + 1))
      ELSE ''
    END,
    30
  )
WHERE btrim(display_name) <> '';
