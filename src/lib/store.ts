export type Category = { id: string; name_ru: string; slug: string; sort_order: number };
export type Variant = { id: string; size_label: string; stock: number; sku: string | null };
export type ProductImage = { image_url: string; alt_ru: string | null; sort_order: number };
export type Product = {
  id: string;
  name_ru: string;
  description_ru: string | null;
  slug: string;
  price: number;
  cover_image_url: string | null;
  sort_order: number;
  categories: Category | null;
  product_variants: Variant[];
  product_images: ProductImage[];
};
export type StoreSettings = {
  whatsapp_phone: string | null;
  instagram_url: string | null;
  currency_code: string;
};
export type CartLine = { variantId: string; productId: string; quantity: number };

export const formatPrice = (amount: number) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} сом`;
