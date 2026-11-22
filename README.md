# Catálogo multinegocio

Plataforma de catálogos digitales para negocios de cualquier rubro (ferretería, abarrotes, perfumería, florería, streaming, etc.). Cada negocio tiene su catálogo público en `dominio/{slug}` y un panel para administrarlo; los pedidos se cierran por WhatsApp.

**Stack:** React + Vite (JavaScript) · Supabase (DB, Auth, Storage) · Vercel

## Puesta en marcha

1. **Base de datos.** En el SQL Editor de Supabase, ejecutar en orden:
   - `supabase/001_schema.sql`: tablas, RLS, funciones y storage
   - `supabase/002_seed_rubros.sql`: plantillas de rubro iniciales
   - `supabase/004_slugs_reservados.sql`: palabras reservadas y verificación de enlaces
   - `supabase/005_realtime_pedidos.sql`: los pedidos nuevos aparecen solos en el panel
   - `supabase/003_cron_opcional.sql`: opcional, requiere activar la extensión `pg_cron`

2. **Variables de entorno.** Copiar `.env.example` como `.env` y completar con los datos de *Project Settings → API*.

3. **Instalar y correr:**
   ```bash
   npm install
   npm run dev
   ```

4. **Superadmin.** Registrarse en `/registro` y luego, en el SQL Editor:
   ```sql
   update public.profiles set role = 'superadmin'
    where id = (select id from auth.users where email = 'TU_CORREO');
   ```

5. **Vercel.** Importar el repo, agregar las mismas variables de entorno y desplegar. `vercel.json` ya redirige todas las rutas a la SPA.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/login`, `/registro` | Público | Acceso de dueños y superadmin |
| `/panel/bienvenida` | Dueño sin negocio | Elegir rubro, nombre y enlace |
| `/panel/*` | Dueño | Panel del negocio |
| `/admin/*` | Superadmin | Activar, extender y suspender negocios |
| `/q/:code` | Público | Redirección de QR (código fijo aunque cambie el slug) |
| `/:slug` | Público | Catálogo del negocio |

## Fases

- [x] **0.** Modelo de datos, RLS, auth, alta de negocio por rubro, superadmin
- [x] **1.** Catálogo público con el sistema visual del catálogo de streaming
- [x] **2.** Panel: productos, categorías, configuración (negocio, horario, entrega, pagos, pedido, enlace), apariencia (color, estilo, tipografías, secciones, módulos) con vista previa
- [x] **3.** Checkout → pedido con código → WhatsApp + panel de pedidos en tiempo real
- [x] **4.** QR personalizable (sticker, tarjeta A6, historia) + analítica
- [x] **5.** Lu local + su sección en el panel (preguntas frecuentes, bandeja de preguntas sin respuesta, perfil)
- [x] **6.** Superadmin: editor de plantillas de rubro
- [ ] **7.** Modo cotización + proforma
