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

        // Estrazione colore dominante pulendo prima la trasparenza con .trim()
        const getDominantColor = async (buffer, defaultColor) => {
            try {
                const { data } = await sharp(buffer)
                    .trim() // Rimuove i bordi trasparenti prima di calcolare il colore
                    .resize(1, 1, { fit: 'fill' })
                    .raw()
                    .toBuffer({ resolveWithObject: true });
                
                return { r: data[0], g: data[1], b: data[2], alpha: 1 };
            } catch (e) {
                return defaultColor;
            }
        };

        const color1 = await getDominantColor(t1Buffer, { r: 50, g: 30, b: 90 });
        const color2 = await getDominantColor(t2Buffer, { r: 180, g: 30, b: 30 });

        // Creazione sfondi dinamici con i colori estratti dai loghi
        const leftBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: color1 }
        }).png().toBuffer();

        const rightBg = await sharp({
            create: { width: halfWidth, height: height, channels: 4, background: color2 }
        }).png().toBuffer();

        // Ridimensionamento loghi squadre
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

        // Gestione logo competizione centrato
        if (comp) {
            try {
                const compBuffer = await fetchImage(comp);
                const resizedCompBuffer = await sharp(compBuffer)
                    .resize(140, 45, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();

                const resizedMeta = await sharp(resizedCompBuffer).metadata();
                const compWidth = resizedMeta.width || 90;
                const compHeight = resizedMeta.height || 35;

                compositePipeline.push({
                    input: resizedCompBuffer,
                    top: height - compHeight - 10,
                    left: Math.floor((width - compWidth) / 2)
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
