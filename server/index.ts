import 'dotenv/config'
import { createLegacyApi } from './legacy-routes.js'

const app = await createLegacyApi()
const port = Number(process.env.PORT ?? 8788)
app.listen(port, () => console.log(`ResearchAgent API listening on http://localhost:${port} · fixture`))
