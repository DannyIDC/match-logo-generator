const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, comp } = req.query;

    if (!t1 || !t2) {
        res.status(400).send('Parametri t1 e t2 obbligatori');
        return;
    }

    try {
        const width = 500;
        const height = 270;
        const halfWidth = width / 2;

        const leftBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: { r: 20, g: 20, b: 30, alpha: 1 } }
        }).png().toBuffer();

        const rightBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: { r: 40, g: 20, b: 20, alpha: 1 } }
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

        const resizedT1 = await sharp(t1Buffer)
            .resize(180, 180, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        const resizedT2 = await sharp(t2Buffer)
            .resize(180, 180, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        let compositePipeline = [
            { input: leftBg, top: 0, left: 0 },
            { input: rightBg, top: 0, left: halfWidth },
            { input: resizedT1, left: Math.floor((halfWidth - 180) / 2), top: Math.floor((height - 180) / 2) },
            { input: resizedT2, left: halfWidth + Math.floor((halfWidth - 180) / 2), top: Math.floor((height - 180) / 2) }
        ];

        if (comp) {
            try {
                const compBuffer = await fetchImage(comp);
                const resizedComp = await sharp(compBuffer)
                    .resize(90, 50, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();

                compositePipeline.push({
                    input: resizedComp,
                    top: height - 60,
                    left: Math.floor((width - 90) / 2)
                });
            } catch (e) {
                console.error("Errore caricamento logo competizione:", e);
            }
        }

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
