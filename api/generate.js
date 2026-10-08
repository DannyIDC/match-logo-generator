const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, bg1, bg2 } = req.query;

    if (!t1 || !t2) {
        res.status(400).send('Parametri t1 e t2 obbligatori');
        return;
    }

    try {
        const width = 500;
        const height = 270;
        const halfWidth = width / 2;

        const background1 = bg1 || '#152043';
        const background2 = bg2 || '#5a1423';

        // Creazione dei due sfondi divisi a metà
        const leftBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: background1 }
        }).png().toBuffer();

        const rightBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: background2 }
        }).png().toBuffer();

        const fetchImage = async (url) => {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!response.ok) throw new Error(`Errore fetch ${url} - Status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        };

        const t1Buffer = await fetchImage(t1);
        const t2Buffer = await fetchImage(t2);

        // Dimensioni grandi e pulite (160x160) centrate nelle rispettive metà
        const resizedT1 = await sharp(t1Buffer)
            .resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        const resizedT2 = await sharp(t2Buffer)
            .resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        let compositePipeline = [
            { input: leftBg, top: 0, left: 0 },
            { input: rightBg, top: 0, left: halfWidth },
            { input: resizedT1, left: Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) },
            { input: resizedT2, left: halfWidth + Math.floor((halfWidth - 160) / 2), top: Math.floor((height - 160) / 2) }
        ];

        const finalImage = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
        .composite(compositePipeline)
        .png()
        .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.send(finalImage);

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione del logo composito');
    }
};
