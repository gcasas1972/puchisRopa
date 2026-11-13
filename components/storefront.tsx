"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/types";

type CartLine = { variantId: string; productId: string; quantity: number };
type Customer = { name: string; email: string; phone: string; address: string; notes: string };
const emptyCustomer: Customer = { name: "", email: "", phone: "", address: "", notes: "" };

function formatPrice(price: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(price);
}

export function Storefront({ products }: { products: CatalogProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pachus-cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed.filter((line): line is CartLine =>
            line && typeof line.variantId === "string" && typeof line.productId === "string" &&
            Number.isInteger(line.quantity) && line.quantity > 0,
          ));
        }
      }
    } catch (error) {
      console.error("No se pudo recuperar el carrito guardado.", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pachus-cart", JSON.stringify(cart));
    } catch (error) {
      console.error("No se pudo guardar el carrito en este navegador.", error);
      setMessage("No se pudo guardar tu bolsita en este navegador.");
    }
  }, [cart]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCartOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const categories = useMemo(() => ["Todos", ...new Set(products.map((product) => product.category))], [products]);
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === "Todos" || product.category === category;
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const matchesQuery = `${product.name} ${product.description} ${product.category}`
      .toLocaleLowerCase("es")
      .includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  const cartDetails = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    const variant = product?.variants.find((item) => item.id === line.variantId);
    return product && variant ? [{ ...line, product, variant }] : [];
  });
  const cartCount = cartDetails.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartDetails.reduce((total, item) => total + item.quantity * item.product.price, 0);

  function addToCart(product: CatalogProduct) {
    const selectedSize = selectedSizes[product.id] ?? product.variants[0]?.id;
    const variant = product.variants.find((item) => item.id === selectedSize);
    if (!variant || variant.stock < 1) return;

    setCart((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (existing) {
        return current.map((line) =>
          line.variantId === variant.id
            ? { ...line, quantity: Math.min(line.quantity + 1, variant.stock) }
            : line,
        );
      }
      return [...current, { variantId: variant.id, productId: product.id, quantity: 1 }];
    });
    setMessage("¡Agregado a tu bolsita! ♡");
    setCartOpen(true);
    window.setTimeout(() => setMessage(""), 2200);
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.variantId !== variantId) return [line];
        const product = products.find((item) => item.id === line.productId);
        const stock = product?.variants.find((variant) => variant.id === variantId)?.stock ?? 0;
        const quantity = Math.min(line.quantity + delta, stock);
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }),
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: cartDetails.map(({ variantId, quantity }) => ({ variantId, quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo registrar el pedido.");
      setOrderComplete(result.orderNumber);
      setCart([]);
      setCustomer(emptyCustomer);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="announcement">
        <span className="announcement__sparkle" aria-hidden="true">✳</span>
        Hecho con amor para quienes hacen tu vida más linda
        <span className="announcement__sparkle" aria-hidden="true">✳</span>
      </div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Pachus, inicio">
          <img src="/images/logo-pachus.jpeg" alt="" className="brand__logo" />
          <span className="brand__wordmark">Pachus<span>pet shop</span></span>
        </Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <a href="#coleccion">Tienda</a><a href="#coleccion">Ropita</a><a href="#nosotros">Nuestra historia</a>
        </nav>
        <div className="header-actions">
          <label className="store-search">
            <span className="sr-only">Buscar productos</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 4.5 4.5"></path></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" />
          </label>
          <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito, ${cartCount} productos`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg>
            <span className="cart-button__label">Mi bolsita</span><span className="cart-count">{cartCount}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero__copy">
            <div className="eyebrow"><span></span> Ropita para los más mimados</div>
            <h1>Pequeños outfits,<br /><em>grandes momentos.</em></h1>
            <p>Prendas cómodas, tiernas y hechas para acompañar cada aventura con tu mejor amigo.</p>
            <a className="button button--primary" href="#coleccion">Descubrir la colección <span aria-hidden="true">↗</span></a>
            <div className="hero__note"><span className="hero__paws" aria-hidden="true">♥ · ♥ · ♥</span><span>Diseñado para ellos,<br /><strong>elegido por vos.</strong></span></div>
          </div>
          <div className="hero__art">
            <div className="hero__circle"></div>
            <div className="hero__sticker"><img src="/images/enterito-rosa.webp" alt="Perrita luciendo un enterito rosa" /></div>
            <div className="hero__tag"><span>♡</span> Un mimo<br />en cada puntada</div>
            <div className="hero__mini-sticker"><img src="/images/coronita.webp" alt="" /></div>
            <span className="hero__star hero__star--one" aria-hidden="true">✳</span>
            <span className="hero__star hero__star--two" aria-hidden="true">✦</span>
          </div>
        </section>

        <section className="benefits" aria-label="Beneficios">
          <div className="benefit"><span className="benefit__icon benefit__icon--coral">♡</span><span><strong>Mucho amor</strong><small>En cada detalle</small></span></div>
          <div className="benefit"><span className="benefit__icon benefit__icon--sage">✳</span><span><strong>Comodidad real</strong><small>Para jugar y pasear</small></span></div>
          <div className="benefit"><span className="benefit__icon benefit__icon--blue">⌂</span><span><strong>Hecho para ellos</strong><small>Talles para cada pancita</small></span></div>
          <a className="size-link" href="#talles">Encontrá su talle <span aria-hidden="true">→</span></a>
        </section>

        <section className="collection section-wrap" id="coleccion">
          <div className="section-heading">
            <div><div className="eyebrow"><span></span> La colección</div><h2>Un look para cada <em>aventura</em></h2><p className="catalog-note">Elegí su talle y consultá la disponibilidad.</p></div>
          </div>
          <div className="category-row" aria-label="Filtrar por categoría">
            {categories.map((item) => <button key={item} className={`category-chip${category === item ? " is-active" : ""}`} type="button" onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product) => {
                const sizes = product.variants.filter((variant) => variant.stock > 0);
                const selected = selectedSizes[product.id] ?? sizes[0]?.id;
                const selectedVariant = sizes.find((variant) => variant.id === selected);
                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-card__visual">
                      {product.isActive && <span className="product-tag">{sizes.length ? "Hecho con amor" : "Agotado"}</span>}
                      <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    </div>
                    <div className="product-card__info">
                      <span className="product-card__category">{product.category}</span>
                      <div className="product-card__name-row"><h3 className="product-card__name">{product.name}</h3><span className="product-card__price">{formatPrice(product.price)}</span></div>
                      <p className="product-card__detail">{product.description}</p>
                      {sizes.length > 0 ? (
                        <label className="size-select">Talle
                          <select value={selected ?? ""} onChange={(event) => setSelectedSizes((current) => ({ ...current, [product.id]: event.target.value }))}>
                            {sizes.map((variant) => <option key={variant.id} value={variant.id}>{variant.size} · {variant.stock} disponibles</option>)}
                          </select>
                        </label>
                      ) : <p className="stock-empty">Sin stock por el momento</p>}
                      <button className="add-button" type="button" disabled={!selectedVariant} onClick={() => addToCart(product)}>
                        Sumar a mi bolsita <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="catalog-empty">
              <span aria-hidden="true">♡</span>
              <h3>{products.length ? "No encontramos ese look" : "Estamos preparando la colección"}</h3>
              <p>{products.length ? "Probá cambiar la búsqueda o el filtro." : "Pronto vas a encontrar acá ropita pensada para los más mimados."}</p>
            </div>
          )}
        </section>

        <section className="story" id="nosotros">
          <div className="story__image"><img src="/images/saludando.webp" alt="Perrita feliz con su ropa Pachus" /><span className="story__sticker">hecho con<br /><strong>amor perruno</strong> ♡</span></div>
          <div className="story__copy">
            <div className="eyebrow"><span></span> Hola, somos Pachus</div>
            <h2>Porque ellos<br />también merecen<br /><em>sentirse especiales.</em></h2>
            <p>En Pachus creemos que cada paseo, siesta y día de lluvia puede convertirse en un momento inolvidable. Creamos ropita cómoda para acompañarlos con mucho estilo y más amor.</p>
            <a className="text-link" href="#coleccion">Conocé la colección <span aria-hidden="true">↗</span></a>
            <div className="story__social">
              <span>Seguinos en</span>
              <a href="https://www.instagram.com/pachuspet?obrf=MWFxZzU5OHpvNjhjOQ==" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>
              <a href="https://www.facebook.com/share/1CMn8CvCUy/" target="_blank" rel="noopener noreferrer">Facebook <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>

        <section className="size-guide section-wrap" id="talles">
          <div className="size-guide__copy">
            <div className="eyebrow"><span></span> El calce perfecto</div>
            <h2>Un talle cómodo,<br /><em>un paseo feliz.</em></h2>
            <p>Revisá los talles disponibles de cada prenda antes de sumarla a tu bolsita. Para encontrar el calce ideal, medí el lomo y el contorno de pecho de tu compañero.</p>
          </div>
          <div className="size-guide__art"><img src="/images/mascota.webp" alt="" /><span>¡Que nada<br />le quede chico!</span></div>
        </section>
      </main>

      <footer className="site-footer">
        <Link className="brand brand--footer" href="/"><img src="/images/logo-pachus.jpeg" alt="" className="brand__logo" /><span className="brand__wordmark">Pachus<span>pet shop</span></span></Link>
        <p>Ropita y accesorios con amor para tus compañeros de cuatro patas.</p>
        <span className="footer-note">Hecho con ♥ para los más mimados</span>
        <Link className="admin-footer-link" href="/admin">Administración</Link>
      </footer>

      <div className={`drawer-backdrop${cartOpen ? " is-visible" : ""}`} onClick={() => setCartOpen(false)} aria-hidden="true"></div>
      <aside className={`cart-drawer${cartOpen ? " is-open" : ""}`} aria-label="Tu bolsita" aria-hidden={!cartOpen}>
        <div className="drawer-heading"><div><span className="eyebrow"><span></span> Pachus</span><h2>Tu bolsita <span aria-hidden="true">♡</span></h2></div><button className="icon-button drawer-close" type="button" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}>✕</button></div>
        {orderComplete ? (
          <div className="order-success"><span aria-hidden="true">♡</span><h3>¡Recibimos tu pedido!</h3><p>Tu número de pedido es <strong>{orderComplete}</strong>. Pachus va a confirmar la disponibilidad y coordinar el pago y la entrega con vos.</p><button className="button button--primary" type="button" onClick={() => { setOrderComplete(""); setCartOpen(false); }}>Seguir mirando</button></div>
        ) : cartDetails.length ? (
          <>
            <div className="cart-items">
              {cartDetails.map(({ variantId, quantity, product, variant }) => (
                <article className="cart-item" key={variantId}>
                  <div className="cart-item__image"><img src={product.imageUrl} alt="" /></div>
                  <div><h3 className="cart-item__name">{product.name} · {variant.size}</h3><span className="cart-item__price">{formatPrice(product.price)} c/u</span><div className="quantity-control"><button type="button" onClick={() => changeQuantity(variantId, -1)} aria-label="Quitar una unidad">−</button><span>{quantity}</span><button type="button" onClick={() => changeQuantity(variantId, 1)} disabled={quantity >= variant.stock} aria-label="Agregar una unidad">+</button></div></div>
                  <span className="cart-item__total">{formatPrice(product.price * quantity)}</span>
                </article>
              ))}
            </div>
            <form className="checkout-form" onSubmit={submitOrder}>
              <div className="cart-subtotal"><span>Total estimado</span><strong>{formatPrice(cartTotal)}</strong></div>
              <p>El pago y el envío se coordinan una vez confirmado el pedido. Al enviarlo, las unidades quedan reservadas.</p>
              <label>Tu nombre<input required minLength={2} maxLength={120} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
              <label>Correo electrónico<input required type="email" maxLength={200} value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
              <label>Teléfono<input required type="tel" minLength={6} maxLength={40} value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
              <label>Dirección o zona de entrega<input required minLength={4} maxLength={250} value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
              <label>Nota (opcional)<textarea maxLength={1000} value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} /></label>
              {message && <p className="form-message" role="alert">{message}</p>}
              <button className="button button--primary checkout-button" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar pedido"} <span aria-hidden="true">↗</span></button>
            </form>
          </>
        ) : (
          <div className="cart-empty"><span aria-hidden="true">🐾</span><h3>Tu bolsita está esperando</h3><p>Encontrá ese outfit que le va a quedar precioso.</p><button type="button" className="button button--primary" onClick={() => setCartOpen(false)}>Ver la colección</button></div>
        )}
      </aside>
      {message && !cartOpen && <div className="toast is-visible" role="status">{message}</div>}
    </>
  );
}
