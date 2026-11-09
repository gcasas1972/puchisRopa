# Pachus

Tienda de ropa para perros creada con Next.js, Neon PostgreSQL y Vercel Blob. El catálogo público lee los productos de la base de datos; el panel privado permite administrar productos, imágenes, talles, stock y pedidos.

## Desarrollo local

1. Usá Node.js 20.19 o superior.
2. Instalá las dependencias con `npm install`.
3. Creá una base PostgreSQL en Neon y copiá la URL de conexión al archivo `.env.local` como `DATABASE_URL`.
4. Configurá `BLOB_READ_WRITE_TOKEN` con el token de un almacenamiento Vercel Blob.
5. Generá una contraseña de administrador con `npm run hash-password` y guardá el hash que imprime.
6. Completá `.env.local` con `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y un `SESSION_SECRET` aleatorio de al menos 32 caracteres (por ejemplo, `openssl rand -base64 48`). No subas ese archivo al repositorio.
7. Ejecutá `npm run db:migrate` y luego `npm run dev`.

La tienda queda en `/` y el panel protegido en `/admin`. El panel no permite crear cuentas: el usuario administrador se configura fuera de la aplicación mediante variables de entorno.

## Despliegue en Vercel

1. Importá este repositorio en Vercel.
2. Conectá una base Neon y un almacén Vercel Blob al proyecto.
3. Agregá las variables `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` en las variables de entorno del proyecto. Generá el hash localmente; nunca uses la contraseña sin hash ni la guardes en el repositorio.
4. Antes del primer despliegue, ejecutá `npm run db:migrate` desde un entorno con `DATABASE_URL` configurada para crear las tablas. La migración inicial requiere una base vacía; si las tablas ya existen, conciliá el historial antes de ejecutarla. Para los despliegues siguientes, aplicá las nuevas migraciones con ese mismo comando antes de desplegar.
5. Dejá `npm run build` como comando de compilación de Vercel. El build compila la aplicación sin necesitar conectividad a la base de datos.
6. Volvé a desplegar tras cambiar variables de entorno.

Usá una URL de conexión de Neon con permisos de esquema (no una credencial de solo lectura) al ejecutar migraciones. La aplicación usa una conexión con soporte transaccional para reservar y devolver stock de forma consistente.

## Catálogo y pedidos

- Cada producto tiene nombre, descripción, categoría, precio en pesos argentinos, foto y variantes de talle con cantidades separadas.
- Las fotos se validan y suben a Vercel Blob; no se guardan en el disco efímero del despliegue.
- Al enviar el formulario, el pedido queda **pendiente de confirmación**, se calcula con los precios vigentes en la base y se reserva el stock dentro de una transacción.
- Desde el panel se puede confirmar o cancelar un pedido pendiente; cancelar devuelve las unidades al stock. Un pedido confirmado puede marcarse como enviado o cancelarse.
- La acción «Archivar» oculta un producto y sus talles sin borrar el historial de pedidos.
- Esta primera versión no procesa pagos ni calcula envíos: esos detalles se coordinan al confirmar el pedido.
