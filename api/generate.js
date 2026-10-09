const sharp = require('sharp');
const opentype = require('opentype.js');

// Cache globale per non riscaricare il font a ogni richiesta
let cachedFont = null;

async function getFont() {
    if (cachedFont) return cachedFont;
    try {
        // Sostituisci questo URL con il link "Raw" del tuo file font su GitHub 
        // (es. https://raw.githubusercontent.com/tuo-utente/tuo-repo/main/fonts/Rubik-Bold.ttf)
        // Oppure puoi usare un font di pubblico dominio temporaneo per testare:
        const fontUrl = 'https://github.com/DannyIDC/match-logo-generator/raw/refs/heads/main/fonts/Rubik-Bold.ttf';
        
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('Impossibile scaricare il font');
        const arrayBuffer = await response.arrayBuffer();
        
        cachedFont = opentype.parse(arrayBuffer);
        return cachedFont;
    } catch (e) {
        console.error("Errore caricamento font da remoto:", e);
        return null;
    }
}

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode } = req.query;

    try {
        const width = 700;
        const height = 160;

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return Buffer.from(await response.arrayBuffer());
        };

        if (mode === 'match_title' && t1 && t2) {
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            const logoSize = 38;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const matchTime = time ? decodeURIComponent(time) : "18:30";
            const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
            const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

            let timePaths = '';
            let sepPaths = '';
            let homePaths = '';
            let awayPaths = '';

            const font = await getFont();
            if (font) {
                timePaths = font.getPath(matchTime, 130, 95, 30).toPathData(2);
                sepPaths = font.getPath('|', 245, 95, 30).toPathData(2);
                homePaths = font.getPath(homeText, 280, 62, 24).toPathData(2);
                awayPaths = font.getPath(awayText, 280, 112, 24).toPathData(2);
            }

            const svgText = `
                <svg width="${width}" height="${height}">
                    <path d="${timePaths}" fill="#ffffff" />
                    <path d="${sepPaths}" fill="#aaaaaa" />
                    <path d="${homePaths}" fill="#ffffff" />
                    <path d="${awayPaths}" fill="#ffffff" />
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText, 'utf-8');

            const finalImage = await sharp(baseBg)
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    { input: resizedT1, top: 32, left: 30 },
                    { input: resizedT2, top: 82, left: 30 }
                ])
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        res.status(400).send('Parametri non validi');
    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione del titolo');
    }
};
