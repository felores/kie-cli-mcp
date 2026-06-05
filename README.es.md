<div align="center">
<pre>
██╗  ██╗██╗███████╗
██║ ██╔╝██║██╔════╝
█████╔╝ ██║█████╗  
██╔═██╗ ██║██╔══╝  
██║  ██╗██║███████╗
╚═╝  ╚═╝╚═╝╚══════╝
 C L I  /  M C P
</pre>
</div>

<p align="center">🇬🇧 <a href="README.md">English</a> &nbsp;·&nbsp; 🇪🇸 <b>Español</b></p>

# Kie.ai CLI + Servidor MCP + Skill de Agente

**Una sola API para los mejores modelos de IA de medios (Veo 3, Nano Banana, Suno, Kling, Flux, ElevenLabs, Seedance y más), expuestos a la vez como servidor MCP y como CLI independiente, generados desde un único registro de herramientas.** Genera video, imágenes, música y voz desde Claude, Codex, OpenCode, Pi-mono, o cualquier harness agéntico, o directo desde tu terminal.

> ## ⚡ Eficiente en tokens por diseño
>
> Un servidor MCP inyecta el schema de **cada** herramienta en el contexto de tu modelo en **cada turno**: con un catálogo así de grande, son muchos tokens gastados en herramientas que quizá nunca llamas.
>
> Esto lo resuelve: carga **solo las herramientas que realmente usas** con `KIE_AI_ENABLED_TOOLS` (o categorías completas con `KIE_AI_TOOL_CATEGORIES`). Tu contexto queda liviano y pagas exactamente la superficie que necesitas, ni más ni menos.
>
> Y el **CLI (`kie-cli`) cuesta cero tokens de contexto** hasta que lo llamas: el agente descubre comandos on-demand con `kie-cli --help` en vez de cargar schemas. Un registro, dos superficies, footprint mínimo.

## Dos formas de usarlo (un núcleo compartido)

El servidor MCP y el CLI se generan desde el mismo registro de herramientas, así que ambos exponen exactamente los mismos modelos y se instalan **de forma independiente**:

- **Servidor MCP**: `@felores/kie-ai-mcp-server`, para Claude Desktop y otros clientes MCP. Ver **Inicio rápido** abajo.
- **CLI**: `@felores/kie-cli` (binario `kie-cli`), para la terminal, sin cliente MCP: `npm i -g @felores/kie-cli`, luego `kie-cli --help`. Ver [`packages/cli/README.md`](packages/cli/README.md).

## 🚀 Inicio rápido

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "npx",
      "args": ["-y", "@felores/kie-ai-mcp-server"],
      "env": {
        "KIE_AI_API_KEY": "tu-api-key-aqui"
      }
    }
  }
}
```

**Consigue tu API key gratis:** [kie.ai/api-key](https://kie.ai/api-key). No requiere configurar callback URL, el servidor lo maneja automáticamente.

**Para Claude Desktop:** agrégalo a `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) o `%APPDATA%\Claude\claude_desktop_config.json` (Windows). También funciona con Cursor, Windsurf, VS Code, Claude Code, OpenCode, Droid, y otros.

### 🎛️ Carga solo las herramientas que necesitas (ahorra tokens)

Agrega cualquiera de estas al bloque `env` de arriba (o expórtalas para el CLI). Este es el corazón de la eficiencia de tokens:

```jsonc
// Whitelist, carga SOLO estas herramientas (mayor prioridad)
"KIE_AI_ENABLED_TOOLS": "nano_banana_image,veo3_generate_video,suno_generate_music"

// Filtro por categoría, carga categorías completas
"KIE_AI_TOOL_CATEGORIES": "image,video"

// Blacklist, carga todo excepto estas
"KIE_AI_DISABLED_TOOLS": "midjourney_generate,runway_aleph_video"
```

- **Categorías:** `image`, `video`, `audio`, `utility`.
- **Prioridad:** `ENABLED_TOOLS` > `TOOL_CATEGORIES` > `DISABLED_TOOLS` > todas las herramientas (default).
- Las herramientas de utilidad (`list_tasks`, `get_task_status`) están siempre activas y no se pueden desactivar, son como rastreas y consultas tus generaciones.

## 🤖 Agent skill (opcional)

`skills/kie-ai/` es un skill de Claude Code que le enseña a los agentes a manejar el comando `kie-cli` (descubrir → generar → consultar → resultado), incluyendo cómo instalar el CLI si falta. Los skills cargan **globalmente**, así que instálalo en tu carpeta personal de skills (un skill a nivel proyecto solo se activa dentro de este repo):

```bash
cp -r skills/kie-ai ~/.claude/skills/kie-ai
# o con symlink para mantenerlo en sync con el repo:
ln -s "$PWD/skills/kie-ai" ~/.claude/skills/kie-ai
```

Después, cualquier sesión puede generar medios en lenguaje natural ("hazme una imagen de…", "convierte esta foto en un video").

## Modelos

Un catálogo unificado y siempre actualizado, que incluye:

- **Google Veo 3**: video cinematográfico con audio sincronizado y salida 1080p
- **Nano Banana 2** (Gemini 3 Flash Image): generación y edición de imágenes rápida con grounding de Google Search
- **Suno V5**: generación de música con voces realistas
- **Kling 3.0**, **Wan 2.7**, **Hailuo 02**, **ByteDance Seedance**, **HappyHorse**, **Runway Aleph**, **Midjourney**: generación y edición de video
- **GPT Image 2**, **Flux Kontext / Flux 2**, **Qwen**, **ByteDance Seedream**, **Ideogram**, **Recraft**, **Topaz**: generación, edición, reencuadre, remoción de fondo y upscaling de imágenes
- **ElevenLabs**: texto a voz y efectos de sonido

Cada herramienta tiene **detección inteligente de modo**: una sola herramienta hace generar / editar / upscale según los parámetros que pasas.

**La lista completa y actual siempre está disponible:** corre `kie-cli --help` (y `kie-cli <tool> --help` para los flags de una herramienta), o ver **[docs/TOOLS.md](docs/TOOLS.md)**.

## Recursos y prompts del MCP

Además de las herramientas, el servidor MCP expone (todo generado desde el registro, así que nunca se desincroniza):

- **Prompts** (slash commands en tu cliente): `/image` y `/video`: guía para elegir y manejar el modelo correcto.
- **Recursos:**
  - `kie://tools/<name>`: una referencia en Markdown por herramienta (parámetros, tipos, defaults), generada desde su schema.
  - `kie://guides/image`, `kie://guides/video`, `kie://guides/quality`: comparativas de modelos y guías de costo/calidad.
  - `kie://tasks/active`, `kie://stats/usage`: vista en vivo de la base de datos local de tareas.

## Ejemplos

### MCP (llamada a herramienta)

```json
{
  "tool": "nano_banana_image",
  "arguments": {
    "prompt": "A futuristic city at sunset, cyberpunk style",
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "output_format": "png"
  }
}
```

### CLI

```bash
# Genera una imagen, luego consulta hasta que termine
kie-cli nano_banana_image --prompt "a red panda coding at night, neon" --resolution 2K --json
kie-cli get_task_status --task_id <id> --json

# Música, sin letra personalizada
kie-cli suno_generate_music --prompt "Upbeat electronic, energetic" --customMode --model V5 --title "Energy Boost"

# Voz
kie-cli elevenlabs_tts --text "Welcome to the future of content creation!" --voice Rachel --model turbo
```

La generación es asíncrona: las herramientas devuelven un `task_id`; consúltalo con `get_task_status` y revisa el trabajo reciente con `list_tasks`. Agrega `--json` al CLI para salida procesable por máquina.

## Configuración

<details>
<summary><strong>⚙️ Variables de entorno</strong></summary>

### Requerida
```bash
export KIE_AI_API_KEY="tu-api-key-aqui"   # Consíguela en https://kie.ai/api-key
```

### Opcionales
```bash
export KIE_AI_BASE_URL="https://api.kie.ai/api/v1"            # URL base de la API
export KIE_AI_TIMEOUT="60000"                                # Timeout de request (ms)
export KIE_AI_DB_PATH="./tasks.db"                           # Ubicación de la base de datos de tareas
export KIE_AI_CALLBACK_URL="https://your-domain.com/webhook" # Callback personalizado
export KIE_AI_CALLBACK_URL_FALLBACK="https://your-proxy.com/callback"  # Default a nivel deployment
```

### Prioridad de callback URL

| Prioridad | Origen | Variable |
|-----------|--------|----------|
| 1 | Por request | argumento `callBackUrl` |
| 2 | Entorno | `KIE_AI_CALLBACK_URL` |
| 3 | Fallback admin | `KIE_AI_CALLBACK_URL_FALLBACK` |
| 4 | Default fijo | `https://proxy.kie.ai/mcp-callback` |

Ver [docs/ADMIN.md](docs/ADMIN.md) para ejemplos con Docker, Kubernetes y Systemd.
</details>

<details>
<summary><strong>📦 Instalar desde el código fuente (para desarrollo)</strong></summary>

```bash
git clone https://github.com/felores/kie-cli-mcp.git
cd kie-cli-mcp
npm install
npm run build       # compila todos los workspaces
npm run typecheck   # type-check de todos los workspaces
npm test            # corre la suite de tests
```

Es un monorepo de npm workspaces: `packages/core` (registro compartido privado, bundleado dentro de los otros), `packages/mcp` (`@felores/kie-ai-mcp-server`) y `packages/cli` (`@felores/kie-cli`). Para agregar un modelo, corre `npm run add-tool -- <name> <category>` y ambas superficies lo toman. Para el servidor dev con auto-reload: `npm run dev -w @felores/kie-ai-mcp-server`.
</details>

## Gestión de tareas

El servidor mantiene una base de datos SQLite local de las tareas que crea y consulta, persistente entre reinicios, usada para rastrear estado y para enrutar al endpoint correcto.

```json
{ "tool": "list_tasks", "arguments": { "limit": 20, "status": "completed" } }
```
```json
{ "tool": "get_task_status", "arguments": { "task_id": "281e5b0...f39b9" } }
```

Nota: `list_tasks` refleja el cache local del MCP, las tareas que ha creado o consultado, no el historial completo de tu cuenta Kie.ai. Ver [docs/DATABASE.md](docs/DATABASE.md).

## Manejo de errores

El servidor expone los códigos de respuesta de Kie.ai (solo trata `code === 200` como éxito):

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 400 | Violación de content policy / solo prompts en inglés |
| 401 | No autorizado (API key inválida) |
| 402 | Créditos insuficientes |
| 404 | Recurso no encontrado |
| 422 | Error de validación / record nulo |
| 429 | Rate limit |
| 455 | Mantenimiento del servicio |
| 500 | Error del servidor / timeout |
| 501 | Generación fallida |

## Solución de problemas

- **"Unauthorized"**: verifica que `KIE_AI_API_KEY` esté seteada y válida en [kie.ai/api-key](https://kie.ai/api-key).
- **"Task not found"**: las tareas pueden expirar después de ~14 días; revisa el task id.
- **Generaciones fallidas**: revisa cumplimiento de content policy, prompts en inglés, y créditos suficientes.

## Documentación

- [docs/TOOLS.md](docs/TOOLS.md): referencia completa de herramientas
- [docs/DATABASE.md](docs/DATABASE.md): base de datos y ciclo de vida de tareas
- [docs/ADMIN.md](docs/ADMIN.md): despliegue y configuración de entorno
- [docs/INTELLIGENCE.md](docs/INTELLIGENCE.md): detección inteligente de modo y optimización de costo

## Soporte

- **Este servidor (MCP o CLI):** abre un pull request en https://github.com/felores/kie-cli-mcp
- **API de Kie.ai:** support@kie.ai o https://docs.kie.ai/
- **API keys:** https://kie.ai/api-key

## Contribuir

Fork → rama de feature → haz tu cambio (agrega tests si aplica) → abre un PR.

## Licencia

MIT, ver [LICENSE](LICENSE).

## Changelog

Ver [CHANGELOG.md](CHANGELOG.md).
