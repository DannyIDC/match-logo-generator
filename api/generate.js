const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

// Carica il font una volta sola all'avvio della funzione per ottimizzare
let font = null;
try {
    const fontPath = path.join(process.cwd(), 'fonts', 'Rubik-Bold.ttf'); // ASSICURATI CHE IL NOME FILE SIA ESATTO
    if (fs.existsSync(fontPath)) {
        font = opentype.loadSync(fontPath);
        console.log("Font caricato con successo da:", fontPath);
    } else {
        console.error("ERRORE: File font non trovato al percorso:", fontPath);
    }
} catch (err) {
    console.error("ERRORE critico durante il caricamento del font:", err);
}

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode } = req.query;

    try {
        const width = 700;
        const height = 160;

        // Funzione di fetch per le immagini (loghi)
        const fetchImage = async (url) => {
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KodiLandscape/1.0)' }
                });
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                return Buffer.from(await response.arrayBuffer());
            } catch (e) {
                console.error(`Errore fetch ${url}:`, e);
                return null;
            }
        };

        if (mode === 'match_title' && t1 && t2) {
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            // Crea una base trasparente
            const baseBg = await sharp({
                create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            const logoSize = 34; // Dimensione loghi
            let compositeOps = [];

            // 1. Gestione Loghi
            if (t1Buffer) {
                const resizedT1 = await sharp(t1Buffer)
                    .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();
                compositeOps.push({ input: resizedT1, top: 32, left: 145 }); // Logo 1
            } else {
                console.warn("Logo 1 non disponibile (URL errato o irraggiungibile)");
            }

            if (t2Buffer) {
                const resizedT2 = await sharp(t2Buffer)
                    .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();
                compositeOps.push({ input: resizedT2, top: 82, left: 145 }); // Logo 2
            } else {
                console.warn("Logo 2 non disponibile (URL errato o irraggiungibile)");
            }

            // 2. Gestione Testo (con opentype.js)
            const matchTime = time ? decodeURIComponent(time) : "";
            const homeText = hname ? decodeURIComponent(hname) : "Casa";
            const awayText = aname ? decodeURIComponent(aname) : "Ospite";

            let textSvg = `<svg width="${width}" height="${height}">`;

            if (font) {
                // Converte il testo in percorsi SVG (Path data)
                const timePath = font.getPath(matchTime, 10, 92, 32).toPathData(2);
                const sepPath = font.getPath('|', 115, 92, 32).toPathData(2);
                const homePath = font.getPath(homeText, 195, 62, 26).toPathData(2);
                const awayPath = font.getPath(awayText, 195, 112, 26).toPathData(2);

                textSvg += `
                    <path d="${timePath}" fill="#ffffff" />
                    <path d="${sepPath}" fill="#aaaaaa" />
                    <path d="${homePath}" fill="#ffffff" />
                    <path d="${awayPath}" fill="#ffffff" />
                `;
            } else {
                // Fallback testuale se opentype.js non ha caricato il font (meno bello ma leggibile)
                textSvg += `
                    <text x="10" y="95" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">${matchTime}</text>
                    <text x="115" y="95" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#aaaaaa">|</text>
                    <text x="195" y="62" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${homeText}</text>
                    <text x="195" y="112" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${awayText}</text>
                `;
            }
            textSvg += '</svg>';

            const textBuffer = Buffer.from(textSvg, 'utf-8');

            // 3. Composizione finale
            compositeOps.push({ input: textBuffer, top: 0, left: 0 });

            const finalImage = await sharp(baseBg)
                .composite(compositeOps)
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        res.status(400).send('Parametri non validi');
    } catch (error) {
        console.error("Errore critico nella generazione:", error);
        res.status(500).send('Errore interno nella generazione del titolo');
    }
};
