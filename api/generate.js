const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, bg1, bg2 } = req.query;

    try {
        const width = 500;
        const height = 270;

        const fetchImage = async (url) => {
            if (!url) return null;
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!response.ok) return null;
                return Buffer.from(await response.arrayBuffer());
            } catch (e) {
                return null;
            }
        };

        // 1. Sfondo diviso o solido scuro coerente con la skin
        const baseBg = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 30, g: 32, b: 40, alpha: 1 } }
        }).png().toBuffer();

        let compositeOperations = [];

        // 2. Download loghi
        const [t1Buffer, t2Buffer] = await Promise.all([fetchImage(t1), fetchImage(t2)]);

        const logoSize = 55;
        // Posizionamento asse X e Y calibrato perfettamente sul box della skin
        const leftPos = 40;

        if (t1Buffer) {
            const resizedT1 = await sharp(t1Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
            compositeOperations.push({ input: resizedT1, top: 75, left: leftPos });
        }

        if (t2Buffer) {
            const resizedT2 = await sharp(t2Buffer)
                .resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
            compositeOperations.push({ input: resizedT2, top: 155, left: leftPos });
        }

        // 3. Testi vettoriali allineati a destra dei loghi
        const matchTime = time ? decodeURIComponent(time) : "18:30";
        const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
        const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

        const fontPath = path.join(process.cwd(), 'fonts', 'Rubik-Bold.ttf');
        let svgText = `<svg width="${width}" height="${height}">`;

        if (fs.existsSync(fontPath)) {
            try {
                const font = opentype.loadSync(fontPath);
                // Coordinate ottimizzate per non sforare l'altezza della skin
                const timePath = font.getPath(matchTime, 120, 62, 26).toPathData(2);
                const homePath = font.getPath(homeText, 120, 115, 22).toPathData(2);
                const awayPath = font.getPath(awayText, 120, 195, 22).toPathData(2);

                svgText += `
                    <path d="${timePath}" fill="#00bfff" />
                    <path d="${homePath}" fill="#ffffff" />
                    <path d="${awayPath}" fill="#ffffff" />
                `;
            } catch (err) {
                svgText += `
                    <text x="120" y="62" font-family="Arial" font-size="26" font-weight="bold" fill="#00bfff">${matchTime}</text>
                    <text x="120" y="115" font-family="Arial" font-size="22" font-weight="bold" fill="#ffffff">${homeText}</text>
                    <text x="120" y="195" font-family="Arial" font-size="22" font-weight="bold" fill="#ffffff">${awayText}</text>
                `;
            }
        }
        svgText += `</svg>`;

        compositeOperations.push({ input: Buffer.from(svgText, 'utf-8'), top: 0, left: 0 });

        const finalImage = await sharp(baseBg)
            .composite(compositeOperations)
            .png()
            .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(finalImage);

    } catch (error) {
        res.status(500).send('Errore nella generazione');
    }
};
