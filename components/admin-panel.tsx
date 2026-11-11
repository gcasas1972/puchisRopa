"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { CatalogProduct, OrderView } from "@/lib/types";

type VariantInput = { size: string; stock: string };
type ProductForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  imageUrl: string;
  isActive: boolean;
  variants: VariantInput[];
};

const blankProduct: ProductForm = {
  name: "",
  description: "",
  category: "",
  price: "",
  imageUrl: "",
  isActive: true,
  variants: [{ size: "", stock: "0" }],
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(price);
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function responseError(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "No se pudo completar la acción.");
  return result;
}

function productToForm(product: CatalogProduct): ProductForm {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    price: String(product.price),
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    variants: product.variants.map(({ size, stock }) => ({ size, stock: String(stock) })),
  };
}

export function AdminPanel({ initialProducts, initialOrders, email }: {
  initialProducts: CatalogProduct[];
  initialOrders: OrderView[];
  email: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  function resetForm() {
    setEditingId(null);
    setForm(blankProduct);
    setPhoto(null);
  }

  function editProduct(product: CatalogProduct) {
    setEditingId(product.id);
    setForm(productToForm(product));
    setPhoto(null);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVariant(index: number, field: keyof VariantInput, value: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setNotice("");
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhoto(null);
      setError("Usá una imagen JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file && (file.size === 0 || file.size > 5 * 1024 * 1024)) {
      setPhoto(null);
      setError("La imagen debe pesar menos de 5 MB.");
      event.target.value = "";
      return;
    }
    setPhoto(file);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let imageUrl = form.imageUrl;
      if (photo) {
        const formData = new FormData();
        formData.set("file", photo);
        imageUrl = (await responseError(await fetch("/api/admin/upload", { method: "POST", body: formData }))).url;
      }
      if (!imageUrl) throw new Error("Elegí una foto para el producto.");

      const payload = {
        ...form,
        imageUrl,
        price: Number(form.price),
        variants: form.variants.map((variant) => ({ size: variant.size, stock: Number(variant.stock) })),
      };
      const endpoint = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const result = await responseError(await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));

      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const refreshedProducts = await responseError(response) as CatalogProduct[];
      setProducts(refreshedProducts);
      resetForm();
      setNotice(result.warning ?? (editingId ? "Producto actualizado." : "Producto creado."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveProduct(product: CatalogProduct) {
    if (!window.confirm(`¿Querés ${product.isActive ? "archivar" : "volver a publicar"} ${product.name}?`)) return;
    setError("");
    setNotice("");
    try {
      if (product.isActive) {
        await responseError(await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" }));
      } else {
        await responseError(await fetch(`/api/admin/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...productToForm(product),
            price: product.price,
            isActive: true,
            variants: product.variants.map(({ size, stock }) => ({ size, stock })),
          }),
        }));
      }
      const refreshed = await responseError(await fetch("/api/admin/products", { cache: "no-store" })) as CatalogProduct[];
      setProducts(refreshed);
      setNotice(product.isActive ? "Producto archivado; no aparecerá en la tienda." : "Producto publicado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado del producto.");
    }
  }

  async function updateOrder(order: OrderView, status: "confirmed" | "shipped" | "cancelled") {
    const prompt = status === "cancelled"
      ? "¿Cancelar el pedido y devolver las unidades al stock?"
      : `¿Cambiar el estado del pedido a "${status === "confirmed" ? "confirmado" : "enviado"}"?`;
    if (!window.confirm(prompt)) return;
    setError("");
    setNotice("");
    try {
      await responseError(await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      }));
      const refreshed = await responseError(await fetch("/api/admin/orders", { cache: "no-store" })) as OrderView[];
      setOrders(refreshed);
      setNotice(`Pedido ${order.orderNumber} actualizado.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el pedido.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <img src="/images/logo-pachus.jpeg" alt="" className="brand__logo" />
          <span className="brand__wordmark">Pachus<span>administración</span></span>
        </Link>
        <div className="admin-header__account"><span>{email}</span><button type="button" className="button button--outline" onClick={logout}>Cerrar sesión</button></div>
      </header>

      <section className="admin-content">
        <div className="admin-title">
          <div><div className="eyebrow"><span></span> Tu espacio Pachus</div><h1>Panel de administración</h1><p>Administrá productos, talles, stock y pedidos.</p></div>
          <Link className="text-link" href="/">Volver a la tienda <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="admin-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === "products"} className={activeTab === "products" ? "is-active" : ""} onClick={() => setActiveTab("products")}>Productos <span>{products.filter((product) => product.isActive).length}</span></button>
          <button type="button" role="tab" aria-selected={activeTab === "orders"} className={activeTab === "orders" ? "is-active" : ""} onClick={() => setActiveTab("orders")}>Pedidos <span>{orders.filter((order) => order.status === "pending").length} pendientes</span></button>
        </div>
        {(error || notice) && <div className={`admin-notice${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</div>}

        {activeTab === "products" ? (
          <div className="admin-product-layout">
            <section className="admin-card admin-product-form">
              <div className="admin-card-heading"><div><span className="eyebrow"><span></span> Catálogo</span><h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2></div>{editingId && <button className="text-link" type="button" onClick={resetForm}>Cancelar edición</button>}</div>
              <form onSubmit={submitProduct}>
                <label>Nombre del producto<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label>Descripción<textarea required minLength={5} maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                <div className="admin-form-row">
                  <label>Categoría<input required minLength={2} maxLength={60} placeholder="Abrigos, Enteritos…" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
                  <label>Precio (ARS)<input required type="number" min="1" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
                </div>
                <div className="admin-photo-field">
                  <span className="admin-photo-title">Foto del producto</span>
                  <div className="admin-photo-control">
                    <div className="admin-photo-preview">
                      {photoPreview || form.imageUrl
                        ? <img src={photoPreview ?? form.imageUrl} alt={form.name ? `Vista previa: ${form.name}` : "Vista previa de la foto"} />
                        : <span>Sin foto</span>}
                    </div>
                    <div className="admin-photo-details">
                      <input className="sr-only" id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="product-photo-help" onChange={selectPhoto} />
                      <label className="admin-photo-button button button--outline" htmlFor="product-photo">{photo ? "Cambiar foto" : form.imageUrl ? "Reemplazar foto" : "Elegir foto"}</label>
                      <span className="field-note">{photo?.name ?? (form.imageUrl ? "La foto actual se conserva si no elegís otra." : "Seleccioná una foto para el producto.")}</span>
                      <small className="field-note" id="product-photo-help">JPG, PNG o WebP · máximo 5 MB</small>
                    </div>
                  </div>
                </div>
                <fieldset className="variant-editor">
                  <legend>Talles y stock</legend>
                  {form.variants.map((variant, index) => (
                    <div className="admin-form-row variant-row" key={index}>
                      <label>Talle<input required maxLength={24} placeholder="S, M, L…" value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} /></label>
                      <label>Cantidad<input required type="number" min="0" max="100000" step="1" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} /></label>
                      <button className="variant-remove" type="button" aria-label="Quitar talle" disabled={form.variants.length === 1} onClick={() => setForm({ ...form, variants: form.variants.filter((_, variantIndex) => variantIndex !== index) })}>−</button>
                    </div>
                  ))}
                  <button className="variant-add" type="button" onClick={() => setForm({ ...form, variants: [...form.variants, { size: "", stock: "0" }] })}>+ Agregar talle</button>
                </fieldset>
                <label className="checkbox-label"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Mostrar en la tienda</label>
                <button className="button button--primary admin-save" type="submit" disabled={busy}>{busy ? "Guardando…" : editingId ? "Guardar cambios" : "Crear producto"}</button>
              </form>
            </section>

            <section className="admin-product-list">
              <div className="admin-card-heading"><div><span className="eyebrow"><span></span> Inventario</span><h2>Productos ({products.length})</h2></div></div>
              {products.length ? products.map((product) => (
                <article className={`admin-product-row${product.isActive ? "" : " is-archived"}`} key={product.id}>
                  <img src={product.imageUrl} alt="" />
                  <div className="admin-product-row__main"><span className="admin-product-row__category">{product.category}{!product.isActive && " · Archivado"}</span><h3>{product.name}</h3><span>{formatPrice(product.price)} · {product.variants.filter((variant) => variant.isActive).map((variant) => `${variant.size}: ${variant.stock}`).join(" · ") || "Sin talles activos"}</span></div>
                  <div className="admin-row-actions"><button type="button" onClick={() => editProduct(product)}>Editar</button><button type="button" onClick={() => archiveProduct(product)}>{product.isActive ? "Archivar" : "Publicar"}</button></div>
                </article>
              )) : <div className="admin-empty">Todavía no hay productos. Completá el formulario para crear el primero.</div>}
            </section>
          </div>
        ) : (
          <section className="admin-orders">
            {orders.length ? orders.map((order) => (
              <article className="admin-order-card" key={order.id}>
                <header className="admin-order-heading"><div><span className="order-number">{order.orderNumber}</span><span className={`order-status order-status--${order.status}`}>{order.status === "pending" ? "Pendiente" : order.status === "confirmed" ? "Confirmado" : order.status === "shipped" ? "Enviado" : "Cancelado"}</span></div><time>{formatDate(order.createdAt)}</time></header>
                <div className="admin-order-content">
                  <div className="admin-order-customer"><h3>{order.customerName}</h3><a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a><span>{order.customerAddress}</span>{order.notes && <p>Nota: {order.notes}</p>}</div>
                  <div className="admin-order-lines">{order.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.productName} · talle {item.size}</span><strong>{formatPrice(item.unitPrice * item.quantity)}</strong></div>)}<div className="admin-order-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div></div>
                </div>
                <footer className="admin-order-actions">
                  {order.status === "pending" && <><button type="button" className="button button--primary" onClick={() => updateOrder(order, "confirmed")}>Confirmar pedido</button><button type="button" className="button button--outline" onClick={() => updateOrder(order, "cancelled")}>Cancelar y devolver stock</button></>}
                  {order.status === "confirmed" && <><button type="button" className="button button--primary" onClick={() => updateOrder(order, "shipped")}>Marcar enviado</button><button type="button" className="button button--outline" onClick={() => updateOrder(order, "cancelled")}>Cancelar y devolver stock</button></>}
                  {order.status === "shipped" && <span>Pedido completado</span>}
                  {order.status === "cancelled" && <span>Pedido cancelado · stock devuelto</span>}
                </footer>
              </article>
            )) : <div className="admin-empty">Todavía no hay pedidos. Cuando un cliente complete una compra, va a aparecer acá.</div>}
          </section>
        )}
      </section>
    </main>
  );
}
