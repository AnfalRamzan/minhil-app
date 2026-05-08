export const TAX_RATE = 0.05; // 5% GST
export const CURRENCY = 'PKR';
export const CURRENCY_SYMBOL = '₨';
export const APP_NAME = 'BillingEase';
export const APP_VERSION = '2.0.0';

export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return `${CURRENCY_SYMBOL} 0`;
  return `${CURRENCY_SYMBOL} ${Math.round(amount).toLocaleString('en-PK')}`;
};

export const formatDate = (dateString, format = 'DD/MM/YYYY') => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  switch(format) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    default: return `${day}/${month}/${year}`;
  }
};

export const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
};

export const formatDateTime = (dateString) => {
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
};