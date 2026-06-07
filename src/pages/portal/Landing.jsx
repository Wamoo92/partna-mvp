import { useNavigate } from 'react-router-dom'
import { useBrand } from '../../lib/BrandContext'

export default function Landing() {
  const brand = useBrand()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center justify-between px-4 py-3" style={{ background: brand.primaryColor }}>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt={brand.businessName}
            className="w-16 h-16 rounded-md object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-white text-xs font-semibold tracking-wide">{brand.businessName}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Powered by Partna</div>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center px-5 pb-7" style={{ background: brand.primaryColor }}>
        <div className="pt-5 text-center">
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {brand.businessName}
          </div>
          <h1 className="text-white text-lg font-bold leading-tight mb-1">Savings Program</h1>
          <p className="text-xs leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {brand.tagline}
          </p>
        </div>

        {/* Card visual */}
        <div className="w-60 h-36 rounded-2xl relative overflow-hidden mb-5"
          style={{ background: brand.primaryColor, border: `1.5px solid ${brand.secondaryColor}` }}>
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, transparent 60%)' }} />
          <div className="absolute top-3 left-3">
            <div className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: brand.secondaryColor }}>
              <img src={brand.logoUrl} alt="" className="w-4 h-4 object-contain" style={{ mixBlendMode: 'screen' }} />
            </div>
          </div>
          <div className="absolute w-7 h-5 rounded top-12 left-3"
            style={{ background: 'linear-gradient(135deg,#EDE5A6,#CFA255)' }} />
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 flex justify-between items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.65)' }}>Your name here</div>
              <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                •••• •••• •••• ••••
              </div>
            </div>
            <div className="flex">
              <div className="w-4 h-4 rounded-full opacity-90" style={{ background: '#EB001B' }} />
              <div className="w-4 h-4 rounded-full opacity-90 -ml-1.5" style={{ background: '#F79E1B' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-5 gap-3"
        style={{ background: '#f0f2f5', marginTop: '-12px' }}>
        <button onClick={() => navigate('/portal/register')}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: brand.secondaryColor, color: brand.primaryColor, border: 'none' }}>
          Register
        </button>
        <button onClick={() => navigate('/portal/login')}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'transparent', color: brand.primaryColor, border: '1.5px solid rgba(27,79,114,0.3)' }}>
          I already have an account — Log in
        </button>
      </div>

      <footer className="text-center py-4 px-5" style={{ background: '#f0f2f5' }}>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/partna-icon.svg" alt="Partna" className="w-6 h-6" />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>Powered by Partna</span>
        </div>
      </footer>

    </div>
  )
}