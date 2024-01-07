// app.js
document.getElementById('paymentButton').addEventListener('click', async () => {
    const destinationAddress = 'RECIPIENT_XRP_ADDRESS'; // Replace with the recipient's XRP address
    const amountToSend = '1'; // The amount of XRP to send

    fetch('/sendPayment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            destinationAddress,
            amount: amountToSend
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.txResult) {
            console.log(`Payment submitted:`, data.txResult);
        } else {
            console.error('Payment failed:', data.error);
        }
    })
    .catch(error => {
        console.error('Error submitting payment:', error);
    });
});
