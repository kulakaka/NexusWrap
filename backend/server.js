// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { RippleAPI } = require('ripple-lib');

const app = express();
app.use(bodyParser.json());

const api = new RippleAPI({
    server: 'wss://s1.ripple.com' // Public rippled server hosted by Ripple
});

app.post('/sendPayment', async (req, res) => {
    const { destinationAddress, amount } = req.body;
    
    await api.connect();

    const payment = {
        source: {
            address: process.env.XRP_WALLET_ADDRESS,
            maxAmount: {
                value: amount.toString(),
                currency: 'XRP'
            }
        },
        destination: {
            address: destinationAddress,
            amount: {
                value: amount.toString(),
                currency: 'XRP'
            }
        }
    };

    try {
        // Prepare the payment
        const preparedTx = await api.preparePayment(process.env.XRP_WALLET_ADDRESS, payment);

        // Sign the transaction
        const { signedTransaction } = api.sign(preparedTx.txJSON, process.env.XRP_WALLET_SECRET);

        // Submit the transaction
        const txResult = await api.submit(signedTransaction);
        
        res.json({ message: 'Payment submitted', txResult });
    } catch (error) {
        res.status(500).json({ message: 'Payment failed', error: error.message });
    } finally {
        await api.disconnect();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
