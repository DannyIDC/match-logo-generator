const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

module.exports = async (req, res) => {
    const { t1, t2, time, hname, aname, mode, bg1, bg2 }	= req.query;

    try {
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
        // MODALITÀ 1: CLEARLOGO IN ALTO (Layout con spaziature e allineamenti corretti)
        // -----------------------------------------------------------------
        if (mode === 'match_title') {
            const width = 1500;
            const height = 320;

            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
            }).png().toBuffer();

            let compositeOps = [];
            const logoSize = 140; // Loghi alti 140px

            // Posizione verticale dei loghi: Primo logo in alto, secondo logo in basso
            const top1 = 20;
            const top2 = 160;

            if (t1Buffer) {
                const r1 = await sharp(t1Buffer).resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
                compositeOps.push({ input: r1, top: top1, left: 430 });
            }
            if (t2Buffer) {
                const r2 = await sharp(t2Buffer).resize(logoSize, logoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
                compositeOps.push({ input: r2, top: top2, left: 430 });
            }

            const matchTime = time ? decodeURIComponent(time) : "13:00";
            const homeText = hname ? decodeURIComponent(hname) : "Magdeburg";
            const awayText = aname ? decodeURIComponent(aname) : "Hannover 96";

            const fontPath = path.join(process.cwd(), 'fonts', 'Rubik-Bold.ttf');
            let svgText = `<svg width="${width}" height="${height}">`;

            if (fs.existsSync(fontPath)) {
                try {
                    const font = opentype.loadSync(fontPath);
                    const fontSize = 140; 
                    
                    // Orario e barra verticale centrati e distanziati a 390
                    const timePath = font.getPath(matchTime, 20, 205, fontSize).toPathData(2);
                    const sepPath = font.getPath('|', 390, 205, fontSize).toPathData(2);
                    
                    // Testi delle squadre allineati verticalmente al centro dei rispettivi loghi (top1 + 95 e top2 + 95)
                    const homePath = font.getPath(homeText, 600, top1 + 98, fontSize).toPathData(2);
                    const awayPath = font.getPath(awayText, 600, top2 + 98, fontSize).toPathData(2);

                    svgText += `
                        <path d="${timePath}" fill="#00bfff" />
                        <path d="${sepPath}" fill="#ffffff" opacity="0.6" />
                        <path d="${homePath}" fill="#ffffff" />
                        <path d="${awayPath}" fill="#ffffff" />
                    `;
                } catch (err) {
                    svgText += `
                        <text x="20" y="205" font-family="Arial" font-size="140" font-weight="bold" fill="#00bfff">${matchTime}</text>
                        <text x="390" y="205" font-family="Arial" font-size="140" font-weight="bold" fill="#ffffff" opacity="0.6">|</text>
                        <text x="600" y="${top1 + 98}" font-family="Arial" font-size="140" font-weight="bold" fill="#ffffff">${homeText}</text>
                        <text x="600" y="${top2 + 98}" font-family="Arial" font-size="140" font-weight="bold" fill="#ffffff">${awayText}</text>
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
        // MODALITÀ 2: TILE MATCH IN BASSO (Invariata, pulita e senza testi)
        // -----------------------------------------------------------------
        const width = 500;
        const height = 270;

        const hexToRgb = (hex) => {
            const cleanHex = hex ? hex.replace('#', '') : '1e2e28';
            const bigint = parseInt(cleanHex, 16);
            return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
        };

        const rgb1 = hexToRgb(bg1 || 'a6192e');
        const rgb2 = hexToRgb(bg2 || 'e30613');

        const baseTileBg = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 30, g: 32, b: 40, alpha: 1 } }
        }).png().toBuffer();

        let tileComposite = [];
        const halfW = Math.floor(width / 2);
        
        const splitBgSvg = `
        <svg width="${width}" height="${height}">
            <rect x="0" y="0" width="${halfW}" height="${height}" fill="rgb(${rgb1.r}, ${rgb1.g}, ${rgb1.b})" />
            <rect x="${halfW}" y="0" width="${width - halfW}" height="${height}" fill="rgb(${rgb2.r}, ${rgb2.g}, ${rgb2.b})" />
        </svg>`;

        tileComposite.push({ input: Buffer.from(splitBgSvg, 'utf-8'), top: 0, left: 0 });

        const bigLogoSize = 140;
        if (t1Buffer) {
            const r1 = await sharp(t1Buffer).resize(bigLogoSize, bigLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
            tileComposite.push({ input: r1, top: Math.floor((height - bigLogoSize) / 2), left: Math.floor(halfW / 2) - Math.floor(bigLogoSize / 2) });
        }
        if (t2Buffer) {
            const r2 = await sharp(t2Buffer).resize(bigLogoSize, bigLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
            tileComposite.push({ input: r2, top: Math.floor((height - bigLogoSize) / 2), left: halfW + Math.floor((width - halfW) / 2) - Math.floor(bigLogoSize / 2) });
        }

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
