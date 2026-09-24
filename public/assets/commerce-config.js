/* PupScene Studio commerce configuration
   Add your live merchant checkout URLs before public sales.
   Do not place secret API keys in this file. */
window.PUPSCENE_CONFIG = {
  productName: 'PupScene Studio',
  priceLabel: 'Localized estimate + USD base price',
  baseCurrency: 'USD',
  demoUrl: 'https://demo.pupscenestudio.site',
  appUrl: 'https://www.pupscenestudio.site',
  supportEmail: 'support@pupscenestudio.site',
  billingPortalUrl: '',
  checkout: {
    // Recommended: a Maya Business Checkout/Payment Link that supports your enabled e-wallets / QR Ph / cards.
    ewallet: '',
    // If your gateway uses the same hosted checkout for cards, paste the same link here.
    card: '',
    // Optional PayPal checkout/payment link for international buyers.
    paypal: '',
    // Optional bank-transfer instruction URL or hosted order form.
    bank: ''
  }
};
