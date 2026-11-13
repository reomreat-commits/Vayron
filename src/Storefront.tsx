import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './lib/supabase';
import { formatPrice, type CartLine, type Category, type Product, type StoreSettings, type Variant } from './lib/store';

type CartEntry = CartLine & { product: Product; variant: Variant };
const CART_KEY = 'vayron-cart-v1';

function readCart(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine =>
      item && typeof item.productId === 'string' && typeof item.variantId === 'string' &&
      Number.isInteger(item.quantity) && item.quantity > 0
    );
  } catch { return []; }
}

function notify(message: string) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('on');
  window.setTimeout(() => toast.classList.remove('on'), 1800);
}

function setCartOpen(open: boolean) {
  document.body.classList.toggle('open', open);
}

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [instagramDraft, setInstagramDraft] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError('Подключение к каталогу ещё не настроено');
      return;
    }
    const client = supabase;
    let active = true;
    const load = async () => {
      setLoading(true);
      const [productResult, categoryResult, settingsResult] = await Promise.all([
        client.from('products').select('id,name_ru,description_ru,slug,price,cover_image_url,sort_order,categories(id,name_ru,slug,sort_order),product_variants(id,size_label,stock,sku),product_images(image_url,alt_ru,sort_order)').eq('is_active', true).order('sort_order'),
        client.from('categories').select('id,name_ru,slug,sort_order').order('sort_order'),
        client.from('store_settings').select('whatsapp_phone,instagram_url,currency_code').eq('id', 1).maybeSingle(),
      ]);
      if (!active) return;
      if (productResult.error) {
        setError('Не удалось загрузить каталог. Попробуйте обновить страницу.');
        setLoading(false);
        return;
      }
      const nextProducts = (productResult.data || []) as unknown as Product[];
      setProducts(nextProducts);
      setCategories((categoryResult.data || []) as Category[]);
      setSettings((settingsResult.data || null) as StoreSettings | null);
      setSelected(Object.fromEntries(nextProducts.map(product => {
        const available = [...(product.product_variants || [])]
          .filter(variant => variant.stock > 0)
          .sort((a, b) => a.size_label.localeCompare(b.size_label, 'ru', { numeric: true }));
        // The original HTML selects the second size by default (M / 41), if available.
        return [product.id, (available[1] || available[0])?.id || ''];
      })));
      setCart(current => current.flatMap(line => {
        const product = nextProducts.find(item => item.id === line.productId);
        const variant = product?.product_variants.find(item => item.id === line.variantId);
        return variant && variant.stock > 0
          ? [{ ...line, quantity: Math.min(line.quantity, variant.stock) }]
          : [];
      }));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Storage may be disabled. */ }
  }, [cart]);

  useEffect(() => {
    const links = document.querySelectorAll<HTMLAnchorElement>('#social a');
    const phone = settings?.whatsapp_phone?.replace(/[^0-9]/g, '');
    const instagram = settings?.instagram_url?.trim();
    const destinations = [phone ? `https://wa.me/${phone}` : null, instagram || null];
    links.forEach((link, index) => {
      const destination = destinations[index];
      if (destination) {
        link.href = destination;
        link.hidden = false;
        link.style.display = '';
      } else {
        link.removeAttribute('href');
        link.hidden = true;
        link.style.display = 'none';
      }
    });
  }, [settings]);

  const visibleProducts = useMemo(
    () => category === 'all' ? products : products.filter(product => product.categories?.id === category),
    [products, category],
  );

  const entries: CartEntry[] = useMemo(() => cart.flatMap(line => {
    const product = products.find(item => item.id === line.productId);
    const variant = product?.product_variants.find(item => item.id === line.variantId);
    return product && variant ? [{ ...line, product, variant }] : [];
  }), [cart, products]);

  const itemCount = entries.reduce((sum, line) => sum + line.quantity, 0);
  const total = entries.reduce((sum, line) => sum + line.quantity * Number(line.product.price), 0);

  function add(product: Product) {
    setInstagramDraft(null);
    const variantId = selected[product.id];
    const variant = product.product_variants.find(item => item.id === variantId);
    if (!variant || variant.stock < 1) {
      notify('Выберите доступный размер');
      return;
    }
    const current = cart.find(line => line.variantId === variant.id);
    if (current && current.quantity >= variant.stock) {
      notify('Больше нет в наличии');
      return;
    }
    setCart(currentCart => {
      const line = currentCart.find(item => item.variantId === variant.id);
      return line
        ? currentCart.map(item => item.variantId === variant.id ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock) } : item)
        : [...currentCart, { productId: product.id, variantId: variant.id, quantity: 1 }];
    });
    const icon = document.getElementById('bagic');
    icon?.classList.remove('bump');
    void icon?.getBoundingClientRect();
    icon?.classList.add('bump');
    notify('Добавлено в корзину');
  }

  function change(entry: CartEntry, delta: number) {
    setInstagramDraft(null);
    setCart(current => current.flatMap(line => {
      if (line.variantId !== entry.variantId) return [line];
      const quantity = Math.min(entry.variant.stock, line.quantity + delta);
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
  }

  async function checkout(channel: 'whatsapp' | 'instagram') {
    if (!entries.length) { notify('Корзина пуста'); return; }
    if (!supabase) { notify('Каталог временно недоступен'); return; }

    const phone = settings?.whatsapp_phone?.replace(/[^0-9]/g, '');
    const instagram = settings?.instagram_url?.trim();
    const destination = channel === 'whatsapp'
      ? (phone ? 'https://wa.me/' + phone : null)
      : (instagram || null);
    if (!destination) {
      notify(channel === 'whatsapp' ? 'WhatsApp магазина ещё не настроен' : 'Instagram магазина ещё не настроен');
      return;
    }

    // Reserve a new tab synchronously in the click handler for mobile popup blockers.
    const popup = channel === 'whatsapp' ? window.open('about:blank', '_blank') : null;
    const productIds = [...new Set(entries.map(entry => entry.productId))];
    const [stockResult, productResult] = await Promise.all([
      supabase.from('product_variants').select('id,stock,product_id').in('id', entries.map(entry => entry.variantId)),
      supabase.from('products').select('id,is_active,price').in('id', productIds),
    ]);
    const stockRows = (stockResult.data || []) as Array<{ id: string; stock: number; product_id: string }>;
    const productRows = (productResult.data || []) as Array<{ id: string; is_active: boolean; price: number }>;
    if (stockResult.error || productResult.error || stockRows.length !== entries.length ||
      productRows.length !== productIds.length ||
      entries.some(entry => {
        const stockRow = stockRows.find(row => row.id === entry.variantId);
        const productRow = productRows.find(row => row.id === entry.productId);
        return !stockRow || stockRow.stock < entry.quantity || !productRow?.is_active ||
          Number(productRow.price) !== Number(entry.product.price) || stockRow.product_id !== entry.productId;
      })) {
      popup?.close();
      notify('Каталог, цена или остатки изменились. Обновите страницу и проверьте корзину.');
      return;
    }

    const messageLines = ['Здравствуйте! Хочу приобрести:'];
    for (const entry of entries) {
      messageLines.push(entry.product.name_ru + ' — размер ' + entry.variant.size_label + ' × ' + entry.quantity + ' — ' + formatPrice(entry.product.price * entry.quantity));
      const image = entry.product.cover_image_url || entry.product.product_images?.[0]?.image_url;
      if (image) messageLines.push('Фото: ' + image);
    }
    messageLines.push('Итого: ' + formatPrice(total));
    const message = messageLines.join('\n');

    if (channel === 'whatsapp') {
      const url = destination + '?text=' + encodeURIComponent(message);
      if (popup) popup.location.href = url; else window.location.href = url;
      return;
    }

    // Clipboard access must happen from a fresh user gesture on iOS/Safari.
    setInstagramDraft(message);
    notify('Состав заказа подготовлен. Скопируй его, затем открой Instagram.');
  }

  async function copyInstagramOrder() {
    if (!instagramDraft) return;
    try {
      await navigator.clipboard.writeText(instagramDraft);
      notify('Заказ скопирован. Теперь открой Instagram.');
    } catch {
      const field = document.getElementById('instagramOrderText') as HTMLTextAreaElement | null;
      field?.focus();
      field?.select();
      const copied = document.execCommand('copy');
      notify(copied ? 'Заказ скопирован. Теперь открой Instagram.' : 'Выдели текст заказа и скопируй его вручную.');
    }
  }

  function openInstagram() {
    const destination = settings?.instagram_url?.trim();
    if (!destination) { notify('Instagram магазина ещё не настроен'); return; }
    const opened = window.open(destination, '_blank');
    if (opened) opened.opener = null;
    else window.location.href = destination;
  }

  const chips = document.getElementById('chips');
  const grid = document.getElementById('grid');
  const items = document.getElementById('items');
  const count = document.getElementById('count');
  const sum = document.getElementById('bsum');
  const totalNode = document.getElementById('total');
  const checkoutActions = document.getElementById('checkoutActions');

  useEffect(() => {
    if (count) count.hidden = itemCount === 0;
    if (sum) sum.hidden = itemCount === 0;
  }, [count, sum, itemCount]);

  useEffect(() => {
    const reveal = 'IntersectionObserver' in window
      ? new IntersectionObserver(observations => observations.forEach(observation => {
          if (observation.isIntersecting) {
            observation.target.classList.add('in');
            reveal?.unobserve(observation.target);
          }
        }), { threshold: 0.12 })
      : null;
    document.querySelectorAll('.card.rv:not(.in)').forEach(node => reveal ? reveal.observe(node) : node.classList.add('in'));

    const open = () => setCartOpen(true);
    const close = () => setCartOpen(false);
    const shade = document.getElementById('shade');
    const openButton = document.getElementById('openCart');
    const closeButton = document.getElementById('closeCart');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    openButton?.addEventListener('click', open);
    closeButton?.addEventListener('click', close);
    shade?.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      reveal?.disconnect();
      openButton?.removeEventListener('click', open);
      closeButton?.removeEventListener('click', close);
      shade?.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [visibleProducts, loading]);

  const portals = [];
  if (checkoutActions) portals.push(createPortal(
    <div className="checkout-actions">
      {instagramDraft ? (
        <div className="instagram-order">
          <textarea id="instagramOrderText" value={instagramDraft} readOnly rows={5} aria-label="Текст заказа для Instagram" />
          <button className="pay" type="button" onClick={() => void copyInstagramOrder()}>Скопировать заказ</button>
          <button className="pay" type="button" onClick={openInstagram}>Открыть Instagram</button>
          <button className="instagram-back" type="button" onClick={() => setInstagramDraft(null)}>Назад</button>
        </div>
      ) : (
        <>
          {settings?.whatsapp_phone && <button className="pay" type="button" onClick={() => void checkout('whatsapp')}>Заказать в WhatsApp</button>}
          {settings?.instagram_url && <button className="pay" type="button" onClick={() => void checkout('instagram')}>Заказать в Instagram</button>}
          {!settings?.whatsapp_phone && !settings?.instagram_url && <div className="empty">Контакты магазина ещё не настроены</div>}
        </>
      )}
    </div>, checkoutActions,
  ));
  if (chips) portals.push(createPortal(
    <>
      <button className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Все</button>
      {categories.map(item => <button key={item.id} className="chip" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name_ru}</button>)}
    </>,
    chips,
  ));

  if (grid) portals.push(createPortal(
    loading ? <div className="empty">Загружаем коллекцию…</div>
      : error ? <div className="empty">{error}</div>
      : visibleProducts.length === 0 ? <div className="empty">{products.length ? 'В этой категории пока нет товаров' : 'Коллекция скоро появится'}</div>
      : visibleProducts.map((product, index) => {
          const variants = [...(product.product_variants || [])]
            .sort((a, b) => a.size_label.localeCompare(b.size_label, 'ru', { numeric: true }));
          const image = product.cover_image_url || [...(product.product_images || [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url;
          const selectedVariant = selected[product.id];
          return (
            <article className="card rv" style={{ '--i': index % 4 } as CSSProperties} key={product.id}>
              <div className="pic" style={{ backgroundColor: "var(--panel)" }}>
                <div className="photo-frame">
                  {image
                    ? <img src={image} alt={product.name_ru} loading="lazy" decoding="async" />
                    : <span className="photo-placeholder">VAYRON</span>}
                </div>
                <span className="photo-index" aria-hidden="true">01 / {String(Math.max(1, product.product_images?.length || 1)).padStart(2, '0')}</span>
              </div>
              <div className="card-copy">
                <h3>{product.name_ru}</h3>
                {product.description_ru && <div className="meta">{product.description_ru}</div>}
                <div className="size-heading">
                  <span>Размер</span>
                  <span>{variants.some(variant => variant.stock > 0) ? 'Выберите вариант' : 'Нет в наличии'}</span>
                </div>
                <div className="szs" role="group" aria-label={`Размеры: ${product.name_ru}`}>
                  {variants.map(variant => (
                    <button
                      key={variant.id}
                      className="sz"
                      type="button"
                      disabled={variant.stock < 1}
                      aria-pressed={selectedVariant === variant.id}
                      aria-label={`${variant.size_label}${variant.stock < 1 ? ', нет в наличии' : ''}`}
                      onClick={() => setSelected(current => ({ ...current, [product.id]: variant.id }))}
                    >{variant.size_label}</button>
                  ))}
                </div>
                <div className="row">
                  <span className="price">{formatPrice(Number(product.price))}</span>
                  <button className="add" type="button" disabled={!variants.some(variant => variant.stock > 0) || !selectedVariant || !variants.some(variant => variant.id === selectedVariant && variant.stock > 0)} onClick={() => add(product)}>В корзину</button>
                </div>
              </div>
            </article>
          );
        }),
    grid,
  ));

  if (items) portals.push(createPortal(
    entries.length ? entries.map(entry => (
      <div className="it" key={entry.variantId}>
        <div className="t">
          {entry.product.cover_image_url
            ? <img src={entry.product.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : 'V'}
        </div>
        <div>
          {entry.product.name_ru}
          <small>{entry.variant.size_label}</small>
          <div className="qty">
            <button aria-label="Меньше" onClick={() => change(entry, -1)}>−</button>
            {entry.quantity}
            <button aria-label="Больше" disabled={entry.quantity >= entry.variant.stock} onClick={() => change(entry, 1)}>+</button>
          </div>
        </div>
        <div>{formatPrice(entry.product.price * entry.quantity)}</div>
      </div>
    )) : <div className="empty">В корзине пока пусто</div>,
    items,
  ));
  if (count) portals.push(createPortal(String(itemCount), count));
  if (sum) portals.push(createPortal(formatPrice(total), sum));
  if (totalNode) portals.push(createPortal(formatPrice(total), totalNode));

  return <>{portals}</>;
}
