const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode, bg1, bg2 } = req.query;

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

        const [t1Buffer, t2Buffer] = await Promise.all([fetchImage(t1), fetchImage(t2)]);

        // -----------------------------------------------------------------
        // MODALITÀ 1: CLEARLOGO IN ALTO (Banner orizzontale con orario e testi)
        // -----------------------------------------------------------------
        if (mode === 'match_title') {
            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 30, g: 32, b: 40, alpha: 1 } }
            }).png().toBuffer();

            let compositeOps = [];
            const logoSize = 55;
            const leftPos = 40;

            if (t1Buffer) {
                const r1 = await sharp(t1Buffer).resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
                compositeOps.push({ input: r1, top: 75, left: leftPos });
            }
            if (t2Buffer) {
                const r2 = await sharp(t2Buffer).resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
                compositeOps.push({ input: r2, top: 155, left: leftPos });
            }

            const matchTime = time ? decodeURIComponent(time) : "18:30";
            const homeText = hname ? decodeURIComponent(hname) : "Heidenheim";
            const awayText = aname ? decodeURIComponent(aname) : "Kaiserslautern";

            const fontPath = path.join(process.cwd(), 'fonts', 'Rubik-Bold.ttf');
            let svgText = `<svg width="${width}" height="${height}">`;

            if (fs.existsSync(fontPath)) {
                try {
                    const font = opentype.loadSync(fontPath);
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
            compositeOps.push({ input: Buffer.from(svgText, 'utf-8'), top: 0, left: 0 });

            const finalImg = await sharp(baseBg).composite(compositeOps).png().toBuffer();
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImg);
        }

        // -----------------------------------------------------------------
        // MODALITÀ 2: TILE IN BASSO (Sfondi colorati delle squadre + loghi grandi)
        // -----------------------------------------------------------------
        const hexToRgb = (hex) => {
            const cleanHex = hex ? hex.replace('#', '') : '1e2e28';
            const bigint = parseInt(cleanHex, 16);
            return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
        };

        const rgb1 = hexToRgb(bg1 || 'a6192e');
        const rgb2 = hexToRgb(bg2 || 'e30613');

        // Sfondo base scuro complessivo
        const baseTileBg = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 30, g: 32, b: 40, alpha: 1 } }
        }).png().toBuffer();

        let tileComposite = [];

        // Creiamo rettangoli colorati per la metà sinistra e destra usando SVG o blocchi di colore puliti
        const halfW = Math.floor(width / 2);
        const splitBgSvg = `
        <svg width="${width}" height="${height}">
            <rect x="0" y="0" width="${halfW}" height="${height}" fill="rgb(${rgb1.r}, ${rgb1.g}, ${rgb1.b})" />
            <rect x="${halfW}" y="0" width="${width - halfW}" height="${height}" fill="rgb(${rgb2.r}, ${rgb2.g}, ${rgb2.b})" />
            <rect x="0" y="210" width="${width}" height="60" fill="rgba(0,0,0,0.5)" />
        </svg>`;

        tileComposite.push({ input: Buffer.from(splitBgSvg, 'utf-8'), top: 0, left: 0 });

        // Loghi grandi al centro delle rispettive metà
        const bigLogoSize = 120;
        if (t1Buffer) {
            const r1 = await sharp(t1Buffer).resize(bigLogoSize, bigLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
            tileComposite.push({ input: r1, top: 45, left: Math.floor(halfW / 2) - Math.floor(bigLogoSize / 2) });
        }
        if (t2Buffer) {
            const r2 = await sharp(t2Buffer).resize(bigLogoSize, bigLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
            tileComposite.push({ input: r2, top: 45, left: halfW + Math.floor((width - halfW) / 2) - Math.floor(bigLogoSize / 2) });
        }

        // Testo in basso nella tile
        const matchTitleText = `${hname || 'Team 1'} vs ${aname || 'Team 2'}`;
        const fontPath = path.join(process.cwd(), 'fonts', 'Rubik-Bold.ttf');
        
        let titleSvg = `<svg width="${width}" height="${height}">`;
        if (fs.existsSync(fontPath)) {
            try {
                const font = opentype.loadSync(fontPath);
                const textPath = font.getPath(matchTitleText, 20, 248, 20).toPathData(2);
                titleSvg += `<path d="${textPath}" fill="#ffffff" />`;
            } catch (err) {
                titleSvg += `<text x="20" y="248" font-family="Arial" font-size="20" font-weight="bold" fill="#ffffff">${matchTitleText}</text>`;
            }
        }
        titleSvg += `</svg>`;

        tileComposite.push({ input: Buffer.from(titleSvg, 'utf-8'), top: 0, left: 0 });

        const finalTile = await sharp(baseTileBg)
            .composite(tileComposite)
            .png()
            .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(finalTile);

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione');
    }
};
