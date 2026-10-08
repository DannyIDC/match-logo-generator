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

        // 1. Creazione dei sfondi divisi (metà sinistra e metà destra con colori o texture di base, es. grigio/scuro)
        // Oppure possiamo caricare sfondi neutri o colori solidi per le due squadre
        const leftBg = sharp({
            create: { width: halfWidth, height: height, channels: 4, background: { r: 20, g: 20, b: 30, alpha: 1 } }
        }).png();

        const rightBg = sharp({
            create: { width: halfWidth, height: height, channels: 4, background: { r: 40, g: 20, b: 20, alpha: 1 } }
        }).png();

        // 2. Download dei loghi delle squadre e della competizione (se presente)
        const fetchImage = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Errore fetch ${url}`);
            return await response.arrayBuffer();
        };

        const t1Buffer = await fetchImage(t1);
        const t2Buffer = await fetchImage(t2);

        // Ridimensionamento dei loghi delle squadre per farli entrare perfettamente nei riquadri (es. max 180x180)
        const resizedT1 = await sharp(Buffer.from(t1Buffer))
            .resize(180, 180, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        const resizedT2 = await sharp(Buffer.from(t2Buffer))
            .resize(180, 180, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        // Composizione base affiancata
        let compositePipeline = [
            { input: await leftBg.toBuffer(), top: 0, left: 0 },
            { input: await rightBg.toBuffer(), top: 0, left: halfWidth },
            // Centratura logo squadra 1 (nel blocco sinistro)
            { input: resizedT1, gravity: 'west', left: Math.floor((halfWidth - 180) / 2), top: Math.floor((height - 180) / 2) },
            // Centratura logo squadra 2 (nel blocco destro)
            { input: resizedT2, gravity: 'east', left: halfWidth + Math.floor((halfWidth - 180) / 2), top: Math.floor((height - 180) / 2) }
        ];

        // 3. Gestione del logo della competizione in basso al centro (se passato)
        if (comp) {
            try {
                const compBuffer = await fetchImage(comp);
                const resizedComp = await sharp(Buffer.from(compBuffer))
                    .resize(90, 50, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();

                // Posizionamento in basso al centro (es. y: height - 60, x: centrato)
                compositePipeline.push({
                    input: resizedComp,
                    top: height - 60,
                    left: Math.floor((width - 90) / 2)
                });
            } catch (e) {
                console.error("Errore caricamento logo competizione:", e);
            }
        }

        // Generazione finale dell'immagine 500x270 PNG
        const finalImage = await sharp({
            create: { width: width, height: height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
        .composite(compositePipeline)
        .png()
        .toBuffer();

        // Cache aggressiva per 24 ore per evitare chiamate ripetute a Vercel
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.send(finalImage);

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione del logo composito');
    }
};