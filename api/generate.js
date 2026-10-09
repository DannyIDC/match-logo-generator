const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode } = req.query;

    try {
        const width = 500;
        const height = 270;

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

            // Sfondo pieno con il colore grigio scuro/nerastro elegante della skin Arctic Horizon 2
            const baseBg = await sharp({
                create: { 
                    width: width, 
                    height: height, 
                    channels: 4, 
                    background: { r: 30, g: 32, b: 40, alpha: 1 } 
                }
            }).png().toBuffer();

            const logoSize = 65;
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const matchTime = time ? decodeURIComponent(time) : "18:30";
            const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
            const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

            const fontFilename = 'Rubik-Bold.ttf';
            const fontPath = path.join(process.cwd(), 'fonts', fontFilename);
            
            let timePaths = '';
            let homePaths = '';
            let awayPaths = '';

            if (fs.existsSync(fontPath)) {
                const font = opentype.loadSync(fontPath);
                // Coordinate calibrate per il box 500x270: loghi a sinistra, testi disposti in modo pulito a destra
                timePaths = font.getPath(matchTime, 140, 60, 26).toPathData(2);
                homePaths = font.getPath(homeText, 140, 145, 24).toPathData(2);
                awayPaths = font.getPath(awayText, 140, 210, 24).toPathData(2);
            }

            const svgText = `
                <svg width="${width}" height="${height}">
                    <path d="${timePaths}" fill="#00bfff" />
                    <path d="${homePaths}" fill="#ffffff" />
                    <path d="${awayPaths}" fill="#ffffff" />
                </svg>
            `;

            const svgBuffer = Buffer.from(svgText, 'utf-8');

            const finalImage = await sharp(baseBg)
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    { input: resizedT1, top: 105, left: 40 },  // Logo squadra di casa
                    { input: resizedT2, top: 175, left: 40 }   // Logo squadra trasferta
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
        res.status(500).send('Errore nella generazione del landscape 500x270');
    }
};
