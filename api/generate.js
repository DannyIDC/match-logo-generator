const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

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

            const logoSize = 34;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const matchTime = time ? decodeURIComponent(time) : "18:30";
            const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
            const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

            // Percorso del font nella cartella fonts del repository
            const fontFilename = 'Rubik-Bold.ttf'; // Assicurati che corrisponda al nome esatto del file caricato
            const fontPath = path.join(process.cwd(), 'fonts', fontFilename);
            
            let timePaths = '';
            let sepPaths = '';
            let homePaths = '';
            let awayPaths = '';

            if (fs.existsSync(fontPath)) {
                const font = opentype.loadSync(fontPath);
                
                // Conversione diretta del testo in tracciati vettoriali geometrici (senza bisogno di font di sistema)
                timePaths = font.getPath(matchTime, 10, 92, 32).toPathData(2);
                sepPaths = font.getPath('|', 115, 92, 32).toPathData(2);
                homePaths = font.getPath(homeText, 195, 58, 26).toPathData(2);
                awayPaths = font.getPath(awayText, 195, 108, 26).toPathData(2);
            }

            // SVG pulito basato solo su forme geometriche vettoriali (<path>)
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
                    { input: resizedT1, top: 32, left: 145 },
                    { input: resizedT2, top: 82, left: 145 }
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
