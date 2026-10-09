const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, bg1, bg2, comp, mode } = req.query;

    try {
        const width = 500;
        const height = 270;

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return Buffer.from(await response.arrayBuffer());
        };

        // MODALITÀ KEYART: Converte qualsiasi logo/immagine in una keyart verticale centrata ed elegante
        if (mode === 'keyart' && comp) {
            const compBuffer = await fetchImage(comp);

            // Sfondo scuro di base
            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
            }).png().toBuffer();

            // Ridimensionamento stretto e verticale (es. altezza 240px, larghezza proporzionata ma contenuta)
            const resizedComp = await sharp(compBuffer)
                .resize(160, 240, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const meta = await sharp(resizedComp).metadata();
            const cWidth = meta.width || 150;
            const cHeight = meta.height || 240;

            const finalImage = await sharp(baseBg)
                .composite([{
                    input: resizedComp,
                    top: Math.floor((height - cHeight) / 2),
                    left: Math.floor((width - cWidth) / 2) // Perfettamente centrata in mezzo allo schermo
                }])
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        // MODALITÀ STANDARD (Default): Loghi delle squadre divisi a metà con i colori
        if (!t1 || !t2) {
            return res.status(400).send('Parametri t1 e t2 obbligatori');
        }

        const halfWidth = width / 2;
        const background1 = bg1 || '#152043';
        const background2 = bg2 || '#5a1423';

        const leftBg = await sharp({ create: { width: halfWidth, height: height, channels: 4, background: background1 } }).png().toBuffer();
        const rightBg = await sharp({ create: { width: halfWidth, height: height, channels: 4, background: background2 } }).png().toBuffer();

        const t1Buffer = await fetchImage(t1);
        const t2Buffer = await fetchImage(t2);

        const resizedT1 = await sharp(t1Buffer).resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
        const resizedT2 = await sharp(t2Buffer).resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

        const finalImage = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
        .composite([
            { input: leftBg, top: 0, left: 0 },
            { input: rightBg, top: 0, left: halfWidth },
            { input: resizedT1, left: Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) },
            { input: resizedT2, left: halfWidth + Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) }
        ])
        .png()
        .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(finalImage);

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione dell\'immagine');
    }
};
