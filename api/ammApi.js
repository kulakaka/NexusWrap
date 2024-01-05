// Express.js example (install using npm install express)
const express = require('express');
const app = express();

const PORT = 3000;

app.post('/swapTokens', async (req, res) => {
    const senderAddress = req.body.senderAddress;
    const amountIn = req.body.amountIn;
    const amountOutMin = req.body.amountOutMin;

    try {
        const result = await swapTokens(senderAddress, amountIn, amountOutMin);
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
