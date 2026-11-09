"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      window.location.assign("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <Link className="brand" href="/">
          <img src="/images/logo-pachus.jpeg" alt="" className="brand__logo" />
          <span className="brand__wordmark">Pachus<span>pet shop</span></span>
        </Link>
        <div className="eyebrow"><span></span> Acceso privado</div>
        <h1>Hola de nuevo</h1>
        <p>Ingresá a tu espacio de administración.</p>
        <label>Correo electrónico<input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-message" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"} <span aria-hidden="true">↗</span></button>
        <Link className="admin-login-back" href="/">Volver a la tienda</Link>
      </form>
    </main>
  );
}
