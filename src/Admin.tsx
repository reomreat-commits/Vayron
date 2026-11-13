import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';
import './styles/admin.css';

type AdminCategory = { id: string; name_ru: string; slug: string };
type AdminVariant = { id: string; size_label: string; stock: number };
type AdminProduct = {
  id: string; name_ru: string; slug: string; price: number; is_active: boolean;
  categories: { name_ru: string } | null; product_variants: AdminVariant[];
};
type Settings = { whatsapp_phone: string | null; instagram_url: string | null };

const transliteration: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};
function makeSlug(value: string) {
  return value.toLowerCase().replace(/[а-яё]/g, letter => transliteration[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function parseVariants(value: string) {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(.+?)\s*:\s*(\d+)$/);
    if (!match) throw new Error(`Неверный формат размера: «${line}». Используй, например, S:3`);
    return { size_label: match[1].trim(), stock: Number(match[2]) };
  });
}

export default function Admin() {
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [settings, setSettings] = useState<Settings>({ whatsapp_phone: '', instagram_url: '' });

  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [productName, setProductName] = useState('');
  const [productNameKy, setProductNameKy] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productSizes, setProductSizes] = useState('S:3\nM:3\nL:2');
  const [productImages, setProductImages] = useState<File[]>([]);
  const [publishImmediately, setPublishImmediately] = useState(false);

  async function loadAdminData() {
    if (!supabase) return;
    const [categoryResult, productResult, settingsResult] = await Promise.all([
      supabase.from('categories').select('id,name_ru,slug').order('sort_order'),
      supabase.from('products').select('id,name_ru,slug,price,is_active,categories(name_ru),product_variants(id,size_label,stock)').order('created_at', { ascending: false }),
      supabase.from('store_settings').select('whatsapp_phone,instagram_url').eq('id', 1).maybeSingle(),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (productResult.error) throw productResult.error;
    setCategories((categoryResult.data || []) as AdminCategory[]);
    setProducts((productResult.data || []) as unknown as AdminProduct[]);
    if (settingsResult.data) setSettings(settingsResult.data as Settings);
  }

  async function verifyAdmin(userId: string) {
    if (!supabase) return false;
    const { data, error } = await supabase.from('profiles').select('role,full_name').eq('id', userId).maybeSingle();
    if (error || data?.role !== 'admin') {
      await supabase.auth.signOut();
      setAuthenticated(false);
      setMessage('У этой учётной записи нет прав администратора.');
      return false;
    }
    setAdminName(data.full_name || '');
    setAuthenticated(true);
    try { await loadAdminData(); }
    catch { setMessage('Не удалось загрузить данные магазина. Проверь подключение и права доступа.'); }
    return true;
  }

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.auth.getSession();
      if (active && data.session) await verifyAdmin(data.session.user.id);
      if (active) setLoading(false);
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: userEmail.trim(), password });
    if (error || !data.user) setMessage('Не удалось войти. Проверь email и пароль.');
    else await verifyAdmin(data.user.id);
    setPassword('');
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthenticated(false);
    setProducts([]);
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const name = categoryName.trim();
    const slug = makeSlug(categorySlug.trim() || name);
    if (!name || !slug) { setMessage('Укажи название и корректный slug категории.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('categories').insert({ name_ru: name, name_ky: name, slug });
    if (error) setMessage(error.code === '23505' ? 'Такой slug категории уже существует.' : 'Не удалось сохранить категорию.');
    else {
      setCategoryName(''); setCategorySlug('');
      await loadAdminData();
      setMessage('Категория добавлена.');
    }
    setBusy(false);
  }

  async function addProduct(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    let variants: ReturnType<typeof parseVariants>;
    try { variants = parseVariants(productSizes); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Проверь размеры и остатки.'); return; }
    if (!productName.trim() || !productCategory || !productPrice || !variants.length ||
      !Number.isFinite(Number(productPrice)) || Number(productPrice) < 0) {
      setMessage('Заполни название, категорию, цену и остатки по размерам.');
      return;
    }
    if (productImages.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      setMessage('Изображения должны быть JPEG, PNG или WebP размером до 10 МБ каждое.');
      return;
    }
    setBusy(true); setMessage('');
    const slug = makeSlug(productName);
    const { data: created, error: productError } = await supabase.from('products').insert({
      name_ru: productName.trim(),
      name_ky: productNameKy.trim() || productName.trim(),
      description_ru: productDescription.trim() || null,
      description_ky: productDescription.trim() || null,
      category_id: productCategory,
      slug,
      price: Number(productPrice),
      is_active: publishImmediately,
    }).select('id').single();
    if (productError || !created) {
      setMessage(productError?.code === '23505' ? 'Товар с таким slug уже существует.' : 'Не удалось создать товар.');
      setBusy(false);
      return;
    }

    const { error: variantsError } = await supabase.from('product_variants').insert(
      variants.map(variant => ({ ...variant, product_id: created.id })),
    );
    if (variantsError) {
      await supabase.from('products').delete().eq('id', created.id);
      setMessage('Не удалось сохранить размеры и остатки. Товар не был опубликован.');
      setBusy(false);
      return;
    }

    try {
      const imageRows: Array<{ product_id: string; image_url: string; alt_ru: string; sort_order: number }> = [];
      for (const [index, file] of productImages.entries()) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${created.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('product-images').getPublicUrl(path);
        imageRows.push({ product_id: created.id, image_url: publicData.publicUrl, alt_ru: productName.trim(), sort_order: index });
      }
      if (imageRows.length) {
        const { error: imagesError } = await supabase.from('product_images').insert(imageRows);
        if (imagesError) throw imagesError;
        await supabase.from('products').update({ cover_image_url: imageRows[0].image_url }).eq('id', created.id);
      }
    } catch {
      setMessage('Товар и размеры сохранены, но загрузка фото не завершилась. Добавь изображения повторно.');
      await loadAdminData();
      setBusy(false);
      return;
    }

    setProductName(''); setProductNameKy(''); setProductDescription('');
    setProductPrice(''); setProductSizes('S:3\nM:3\nL:2'); setProductImages([]);
    setPublishImmediately(false);
    await loadAdminData();
    setMessage('Товар сохранён.');
    setBusy(false);
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const phone = settings.whatsapp_phone?.replace(/[^0-9]/g, '') || null;
    const instagram = settings.instagram_url?.trim() || null;
    if (instagram && !/^https:\/\/(www\.)?instagram\.com\//i.test(instagram)) {
      setMessage('Для Instagram укажи полную ссылку https://instagram.com/…');
      return;
    }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('store_settings').update({
      whatsapp_phone: phone, instagram_url: instagram,
    }).eq('id', 1);
    setMessage(error ? 'Не удалось сохранить контакты.' : 'Контакты магазина обновлены.');
    setBusy(false);
  }

  async function setProductActive(product: AdminProduct, isActive: boolean) {
    if (!supabase) return;
    const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', product.id);
    if (error) setMessage('Не удалось изменить статус товара.');
    else setProducts(current => current.map(item => item.id === product.id ? { ...item, is_active: isActive } : item));
  }

  async function saveStock(variant: AdminVariant, value: string) {
    if (!supabase) return;
    const stock = Number(value);
    if (!Number.isInteger(stock) || stock < 0) { setMessage('Остаток должен быть целым числом не меньше нуля.'); return; }
    const { error } = await supabase.from('product_variants').update({ stock }).eq('id', variant.id);
    if (error) setMessage('Не удалось обновить остаток.');
    else setProducts(current => current.map(product => ({
      ...product,
      product_variants: product.product_variants.map(item => item.id === variant.id ? { ...item, stock } : item),
    })));
  }

  if (!supabase) return <main className="admin-shell"><section className="admin-panel"><h1>VAYRON / ADMIN</h1><p>Не настроено подключение к Supabase.</p></section></main>;
  if (loading) return <main className="admin-shell"><section className="admin-panel">Проверяем доступ…</section></main>;

  if (!authenticated) return (
    <main className="admin-shell">
      <form className="admin-panel admin-login" onSubmit={signIn}>
        <a className="admin-back" href="/">← VAYRON</a>
        <p className="admin-eyebrow">PRIVATE ACCESS</p>
        <h1>Панель управления</h1>
        <label>Email<input type="email" autoComplete="username" value={userEmail} onChange={event => setUserEmail(event.target.value)} required /></label>
        <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {message && <p className="admin-message">{message}</p>}
        <button className="admin-primary" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
        <p className="admin-note">Регистрация администраторов отключена. Доступ только для существующей учётной записи владельца.</p>
      </form>
    </main>
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="admin-eyebrow">VAYRON / CONTROL ROOM</p><h1>Панель управления</h1><span>{adminName || userEmail}</span></div>
        <div className="admin-header-actions"><a href="/">Открыть магазин</a><button onClick={signOut}>Выйти</button></div>
      </header>
      {message && <p className="admin-message admin-banner">{message}</p>}
      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Добавить категорию</h2>
          <form onSubmit={addCategory}>
            <label>Название<input value={categoryName} onChange={event => setCategoryName(event.target.value)} required /></label>
            <label>Slug (необязательно)<input value={categorySlug} onChange={event => setCategorySlug(event.target.value)} placeholder="hoodies" /></label>
            <button className="admin-primary" disabled={busy}>Сохранить категорию</button>
          </form>
          <div className="admin-list">{categories.map(item => <div key={item.id}><strong>{item.name_ru}</strong><small>{item.slug}</small></div>)}</div>
        </section>

        <section className="admin-panel admin-wide">
          <h2>Добавить товар</h2>
          <form onSubmit={addProduct} className="admin-product-form">
            <label>Название (RU)<input value={productName} onChange={event => setProductName(event.target.value)} required /></label>
            <label>Название (KY)<input value={productNameKy} onChange={event => setProductNameKy(event.target.value)} /></label>
            <label>Категория<select value={productCategory} onChange={event => setProductCategory(event.target.value)} required><option value="">Выбери категорию</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name_ru}</option>)}</select></label>
            <label>Цена, сом<input type="number" min="0" step="1" value={productPrice} onChange={event => setProductPrice(event.target.value)} required /></label>
            <label className="admin-full">Описание<textarea value={productDescription} onChange={event => setProductDescription(event.target.value)} rows={3} /></label>
            <label className="admin-full">Размеры и остатки (каждая строка: S:3)<textarea value={productSizes} onChange={event => setProductSizes(event.target.value)} rows={4} required /></label>
            <label className="admin-full">Фотографии (JPEG / PNG / WebP, до 10 МБ)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setProductImages(Array.from(event.target.files || []))} /></label>
            <label className="admin-check"><input type="checkbox" checked={publishImmediately} onChange={event => setPublishImmediately(event.target.checked)} /> Сразу опубликовать товар</label>
            <button className="admin-primary admin-full" disabled={busy || categories.length === 0}>{busy ? 'Сохраняем…' : 'Создать товар'}</button>
            {categories.length === 0 && <p className="admin-note admin-full">Сначала добавь хотя бы одну категорию.</p>}
          </form>
        </section>

        <section className="admin-panel admin-wide">
          <h2>Каталог и остатки</h2>
          {products.length === 0 ? <p className="admin-note">Товаров пока нет.</p> : <div className="admin-products">
            {products.map(product => (
              <article className="admin-product" key={product.id}>
                <div className="admin-product-top"><div><strong>{product.name_ru}</strong><small>{product.categories?.name_ru || 'Без категории'} · {formatPriceAdmin(Number(product.price))}</small></div>
                  <label className="admin-check"><input type="checkbox" checked={product.is_active} onChange={event => void setProductActive(product, event.target.checked)} /> Опубликован</label>
                </div>
                <div className="admin-stock">{product.product_variants.map(variant => (
                  <label key={variant.id}>{variant.size_label}<input type="number" min="0" step="1" defaultValue={variant.stock} onBlur={event => void saveStock(variant, event.currentTarget.value)} /></label>
                ))}</div>
              </article>
            ))}
          </div>}
        </section>

        <section className="admin-panel">
          <h2>Контакты магазина</h2>
          <form onSubmit={saveSettings}>
            <label>WhatsApp — номер с кодом страны<input value={settings.whatsapp_phone || ''} onChange={event => setSettings(current => ({ ...current, whatsapp_phone: event.target.value }))} placeholder="996…" /></label>
            <label>Instagram — ссылка<input value={settings.instagram_url || ''} onChange={event => setSettings(current => ({ ...current, instagram_url: event.target.value }))} placeholder="https://instagram.com/…" /></label>
            <button className="admin-primary" disabled={busy}>Сохранить контакты</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function formatPriceAdmin(value: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} сом`;
}
