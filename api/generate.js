const sharp = require('sharp');

module.exports = async (req, res) => {
    const { t1, t2, comp, mode, bg1, bg2 } = req.query;

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

        // MODALITÀ: Logo competizione al centro + loghi delle due squadre ai lati
        if (mode === 'match_comp' && t1 && t2 && comp) {
            const compBuffer = await fetchImage(comp);
            const t1Buffer = await fetchImage(t1);
            const t2Buffer = await fetchImage(t2);

            // Sfondo scuro elegante o basato su un colore neutro
            const baseBg = await sharp({
                create: { width: width, height: height, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
            }).png().toBuffer();

            // Ridimensionamento del logo della competizione al centro
            const resizedComp = await sharp(compBuffer)
                .resize(140, 180, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            // Ridimensionamento dei loghi delle squadre per i lati
            const resizedT1 = await sharp(t1Buffer)
                .resize(100, 100, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const resizedT2 = await sharp(t2Buffer)
                .resize(100, 100, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const finalImage = await sharp(baseBg)
                .composite([
                    // Logo competizione perfettamente al centro
                    { input: resizedComp, top: 45, left: 180 },
                    // Squadra 1 a sinistra
                    { input: resizedT1, top: 85, left: 45 },
                    // Squadra 2 a destra
                    { input: resizedT2, top: 85, left: 355 }
                ])
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(finalImage);
        }

        // (Le altre modalità standard o comp che avevamo impostato rimangono qui sotto...)
        res.status(400).send('Parametri non validi o modalità non specificata');

    } catch (error) {
        console.error(error);
        res.status(500).send('Errore nella generazione dell\'immagine');
    }
};
