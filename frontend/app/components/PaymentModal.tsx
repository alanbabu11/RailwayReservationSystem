'use client';

import { useState } from 'react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentData: { payment_method: string; transaction_id: string }) => void;
  amount: number;
  trainName: string;
  passengersCount: number;
  coachClass: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  amount,
  trainName,
  passengersCount,
  coachClass,
}: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'upi' | 'card' | 'netbanking' | 'wallet'>('upi');
  
  // UPI State
  const [upiId, setUpiId] = useState('');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'other'>('gpay');
  
  // Card State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Bank State
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // Processing state: 'idle' | 'processing' | 'verifying' | 'success'
  const [status, setStatus] = useState<'idle' | 'processing' | 'verifying' | 'success'>('idle');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePay = () => {
    setError('');
    
    if (activeTab === 'upi' && upiApp === 'other' && !upiId.trim()) {
      setError('Please enter a valid VPA / UPI ID');
      return;
    }
    if (activeTab === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setError('Please enter a 16-digit card number');
        return;
      }
      if (!expiry || !cvv) {
        setError('Please enter Card Expiry and CVV');
        return;
      }
    }

    setStatus('processing');

    setTimeout(() => {
      setStatus('verifying');
      setTimeout(() => {
        setStatus('success');
        const txnId = `TXN${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const methodMap = {
          upi: `UPI (${upiApp.toUpperCase()})`,
          card: 'Credit/Debit Card',
          netbanking: `NetBanking (${selectedBank})`,
          wallet: 'Paytm Wallet',
        };

        setTimeout(() => {
          onSuccess({
            payment_method: methodMap[activeTab],
            transaction_id: txnId,
          });
        }, 800);
      }, 1200);
    }, 1200);
  };

  const formatCardNumber = (val: string) => {
    const v = val.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  const formatExpiry = (val: string) => {
    const v = val.replace(/[^0-9]/gi, '');
    if (v.length >= 2) return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    return v;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white border border-slate-300 rounded-md max-w-md w-full shadow-lg overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 text-white relative">
          <button
            onClick={onClose}
            disabled={status !== 'idle'}
            className="absolute top-3 right-3 text-slate-300 hover:text-white text-sm"
          >
            ✕ Close
          </button>
          <div className="text-xs text-slate-300 uppercase tracking-wider mb-1">
            Payment Gateway
          </div>
          <div className="flex justify-between items-baseline">
            <div>
              <p className="text-xs text-slate-300">{trainName} ({passengersCount} Passenger, {coachClass})</p>
              <h2 className="text-2xl font-bold text-white">Amount: ₹{amount}</h2>
            </div>
          </div>
        </div>

        {/* Processing State View */}
        {status !== 'idle' ? (
          <div className="p-8 text-center space-y-4">
            {status === 'processing' && (
              <div>
                <h3 className="text-base font-bold text-slate-800">Processing Payment...</h3>
                <p className="text-xs text-slate-600 mt-1">Please wait while we connect to your bank.</p>
              </div>
            )}

            {status === 'verifying' && (
              <div>
                <h3 className="text-base font-bold text-slate-800">Verifying Transaction...</h3>
                <p className="text-xs text-slate-600 mt-1">Authorizing payment with bank gateway.</p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <h3 className="text-lg font-bold text-green-700">Payment Successful!</h3>
                <p className="text-xs text-slate-600 mt-1">Finalizing booking...</p>
              </div>
            )}
          </div>
        ) : (
          /* Payment Options View */
          <div className="p-5">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-4">
              {(['upi', 'card', 'netbanking', 'wallet'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 ${
                    activeTab === tab ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'upi' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-700">Select UPI Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpiApp('gpay')}
                    className={`p-2 border text-xs rounded text-center ${
                      upiApp === 'gpay' ? 'border-blue-700 bg-blue-50 font-bold text-blue-900' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    Google Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiApp('phonepe')}
                    className={`p-2 border text-xs rounded text-center ${
                      upiApp === 'phonepe' ? 'border-blue-700 bg-blue-50 font-bold text-blue-900' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    PhonePe
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiApp('paytm')}
                    className={`p-2 border text-xs rounded text-center ${
                      upiApp === 'paytm' ? 'border-blue-700 bg-blue-50 font-bold text-blue-900' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    Paytm UPI
                  </button>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Or enter UPI ID / VPA</label>
                  <input
                    type="text"
                    placeholder="example@upi"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      setUpiApp('other');
                    }}
                    className="input-field text-xs"
                  />
                </div>
              </div>
            )}

            {activeTab === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Card Number</label>
                  <input
                    type="text"
                    placeholder="4532 8921 0943 1124"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="input-field text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                    <input
                      type="password"
                      placeholder="•••"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name on Card</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>
            )}

            {activeTab === 'netbanking' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-700">Select Bank</label>
                <div className="grid grid-cols-2 gap-2">
                  {['HDFC', 'SBI', 'ICICI', 'AXIS', 'KOTAK', 'PNB'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2 border text-xs rounded text-center ${
                        selectedBank === bank ? 'border-blue-700 bg-blue-50 font-bold text-blue-900' : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {bank} Bank
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="p-3 border border-slate-200 rounded text-center">
                <p className="text-xs font-medium text-slate-700">Paytm Wallet / Postpaid</p>
              </div>
            )}

            {error && (
              <div className="mt-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <div className="mt-5">
              <button
                type="button"
                onClick={handlePay}
                className="btn-primary w-full text-xs py-2.5 font-bold"
              >
                Pay ₹{amount}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
