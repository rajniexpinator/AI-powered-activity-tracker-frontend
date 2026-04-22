/**
 * Generates square PWA icons from the brand logo (required for Chrome installability).
 * Run from Frontend: npm run icons  (needs sharp: npm i -D sharp)
 */
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'src', 'assets', 'ApexLogoFinal_Color.png')
const bg = { r: 63, g: 75, b: 157, alpha: 1 }

await sharp(src)
  .resize(192, 192, { fit: 'contain', background: bg })
  .png()
  .toFile(path.join(root, 'public', 'pwa-192.png'))

await sharp(src)
  .resize(512, 512, { fit: 'contain', background: bg })
  .png()
  .toFile(path.join(root, 'public', 'pwa-512.png'))

console.log('Wrote public/pwa-192.png and public/pwa-512.png')
