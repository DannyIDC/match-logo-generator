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

        // Ridimensionamento ridotto e sicuro dei loghi per evitare sbavature o tagli fuori quadro
        const maxLogoSize = 110;

        const resizedT1 = await sharp(t1Buffer)
            .resize(maxLogoSize, maxLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        const resizedT2 = await sharp(t2Buffer)
            .resize(maxLogoSize, maxLogoSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        // Otteniamo le dimensioni effettive dopo il resize per centrarli perfettamente nel proprio mezzo schermo
        const meta1 = await sharp(resizedT1).metadata();
        const meta2 = await sharp(resizedT2).metadata();

        const t1Width = meta1.width || maxLogoSize;
        const t1Height = meta1.height || maxLogoSize;
        const t2Width = meta2.width || maxLogoSize;
        const t2Height = meta2.height || maxLogoSize;

        // Creazione di un piccolo badge centrale con la scritta "VS" pulita ed elegante
        const vsSvg = Buffer.from(`
            <svg width="40" height="40">
              <circle cx="20" cy="20" r="18" fill="#111111" fill-opacity="0.6" stroke="#ffffff" stroke-width="2"/>
              <text x="20" y="25" font-size="12" font-family="Arial, sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">VS</text>
            </svg>
        `);

        let compositePipeline = [
            { input: leftBg, top: 0, left: 0 },
            { input: rightBg, top: 0, left: halfWidth },
            // Logo 1 centrato nella sua metà sinistra
            { 
                input: resizedT1, 
                left: Math.floor((halfWidth - t1Width) / 2), 
                top: Math.floor((height - t1Height) / 2) 
            },
            // Logo 2 centrato nella sua metà destra
            { 
                input: resizedT2, 
                left: halfWidth + Math.floor((halfWidth - t2Width) / 2), 
                top: Math.floor((height - t2Height) / 2) 
            },
            // Badge "VS" posizionato esattamente al centro della linea di divisione
            { 
                input: vsSvg, 
                left: Math.floor((width - 40) / 2), 
                top: Math.floor((height - 40) / 2) 
            }
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
