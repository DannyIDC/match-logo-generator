const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode } = req.query;

    try {
        const width = 500;
        const height = 270;

        // Funzione sicura per scaricare i loghi
        const fetchImage = async (url) => {
            if (!url) return null;
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (!response.ok) return null;
                return Buffer.from(await response.arrayBuffer());
            } catch (e) {
                return null;
            }
        };

        // 1. Creiamo uno sfondo solido e scuro (stile Arctic Horizon 2)
        const baseBg = await sharp({
            create: { 
                width: width, 
                height: height, 
                channels: 4, 
                background: { r: 30, g: 32, b: 40, alpha: 1 } 
            }
        }).png().toBuffer();

        let compositeOperations = [];

        // 2. Scarichiamo e posizioniamo i loghi delle squadre a sinistra
        const [t1Buffer, t2Buffer] = await Promise.all([
            fetchImage(t1),
            fetchImage(t2)
        ]);

        const logoSize = 65;
        if (t1Buffer) {
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
            compositeOperations.push({ input: resizedT1, top: 55, left: 35 }); // Logo Casa
        }

        if (t2Buffer) {
            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
            compositeOperations.push({ input: resizedT2, top: 145, left: 35 }); // Logo Trasferta
        }

        // 3. Gestione Testi con opentype.js
        const matchTime = time ? decodeURIComponent(time) : "18:30";
        const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
        const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

        const fontFilename = 'Rubik-Bold.ttf';
        const fontPath = path.join(process.cwd(), 'fonts', fontFilename);
        
        let svgText = `<svg width="${width}" height="${height}">`;

        if (fs.existsSync(fontPath)) {
            try {
                const font = opentype.loadSync(fontPath);
                const timePath = font.getPath(matchTime, 125, 75, 30).toPathData(2);
                const homePath = font.getPath(homeText, 125, 140, 24).toPathData(2);
                const awayPath = font.getPath(awayText, 125, 205, 24).toPathData(2);

                svgText += `
                    <path d="${timePath}" fill="#00bfff" />
                    <path d="${homePath}" fill="#ffffff" />
                    <path d="${awayPath}" fill="#ffffff" />
                `;
            } catch (err) {
                // Fallback standard se il parsing del font fallisce
                svgText += `
                    <text x="125" y="75" font-family="Arial" font-size="30" font-weight="bold" fill="#00bfff">${matchTime}</text>
                    <text x="125" y="140" font-family="Arial" font-size="24" font-weight="bold" fill="#ffffff">${homeText}</text>
                    <text x="125" y="205" font-family="Arial" font-size="24" font-weight="bold" fill="#ffffff">${awayText}</text>
                `;
            }
        }
        svgText += `</svg>`;

        const svgBuffer = Buffer.from(svgText, 'utf-8');
        compositeOperations.push({ input: svgBuffer, top: 0, left: 0 });

        // 4. Assemblaggio finale dell'immagine
        const finalImage = await sharp(baseBg)
            .composite(compositeOperations)
            .png()
            .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(finalImage);

    } catch (error) {
        console.error("Errore critico:", error);
        res.status(500).send('Errore nella generazione del landscape');
    }
};
