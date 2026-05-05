-- Create public bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,  -- 2 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "Auth users can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

-- Allow authenticated users to update (replace) their uploads
create policy "Auth users can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images');

-- Allow authenticated users to delete product images
create policy "Auth users can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');

-- Allow public read (bucket is public, but add explicit policy)
create policy "Public can view product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');
