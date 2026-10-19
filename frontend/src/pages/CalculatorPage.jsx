import { useState } from 'react';
import OptionCard from '../components/OptionCard';

/**
 * CalculatorPage.jsx
 * 1:1 port of calculator.html — same 6-step wizard, same logic, same UI
 *
 * Steps:
 *   1  → Customer details (name, email, address, city, phone)
 *   2  → Category (WARDROBE / WOODEN_DOOR / KITCHEN)
 *   3  → Kitchen shape (only if KITCHEN)
 *   3b → Island type (only if KITCHEN + ISLAND)
 *   3c → Wardrobe door type (only if WARDROBE)
 *   3d → Wardrobe door material (only if WARDROBE)
 *   4  → Budget tier (BUDGET / PREMIUM / LUXURY)
 *   5  → Measurements
 *   6  → Result
 */

const TOTAL_STEPS = 6;

// AI Studio se image aati hai:  /?ai_image=/files/xyz.jpg   (ek hi server, to sirf /files/ path chalega)
function readAiImageFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('ai_image');
    if (raw) {
      const path = new URL(raw, window.location.origin).pathname;
      if (/^\/files\/[A-Za-z0-9._-]+$/.test(path)) {
        sessionStorage.setItem('prisha_ai_image', path);
        return path;
      }
    }
    return sessionStorage.getItem('prisha_ai_image') || '';
  } catch {
    return '';
  }
}

// Budget image map by category + tier
const BUDGET_IMAGES = {
  KITCHEN: {
    L_SHAPE:  { BUDGET: '/images/l _shape_ budget_ kitchen.jpg',  PREMIUM: '/images/l _shape_ premium _kitchen.jpg',  LUXURY: '/images/l _shape_luxury_ kitchen.jpg' },
    U_SHAPE:  { BUDGET: '/images/u _shape _budget _kitchen.jpg',  PREMIUM: '/images/u _shape_premium_ kitchen.jpg',   LUXURY: '/images/u_ shape_luxury_ kitchen.jpg' },
    ISLAND:   { BUDGET: '/images/island.jpg',                     PREMIUM: '/images/island_premium_ kitchen.jpg',    LUXURY: '/images/island_ luxury _kitchen.jpg' },
    PARALLEL: { BUDGET: '/images/parallel-shape-budget-kitchen.jpg', PREMIUM: '/images/1-parallel-kitchen _premium-design.png', LUXURY: '/images/parellel _shape_luxury_ kitchen.jpg' },
  },
  WARDROBE: {
    BUDGET: '/images/wordrobe_budget.jpg', PREMIUM: '/images/wardrobe_premium .jpg', LUXURY: '/images/wardrobe_luxury.jpg',
  },
  WOODEN_DOOR: {
    BUDGET: '/images/woodendor_budget.jpg', PREMIUM: '/images/woodendoor_premium.jpg', LUXURY: '/images/woodendoor_luxury.jpg',
  },
};

function getBudgetImages(category, kitchenType) {
  if (category === 'KITCHEN' && kitchenType) {
    const map = BUDGET_IMAGES.KITCHEN[kitchenType] || {};
    return [
      { value: 'BUDGET',  label: 'Budget',  imgSrc: map.BUDGET },
      { value: 'PREMIUM', label: 'Premium', imgSrc: map.PREMIUM },
      { value: 'LUXURY',  label: 'Luxury',  imgSrc: map.LUXURY },
    ];
  }
  if (category === 'WARDROBE') {
    const map = BUDGET_IMAGES.WARDROBE;
    return [
      { value: 'BUDGET',  label: 'Budget',  imgSrc: map.BUDGET },
      { value: 'PREMIUM', label: 'Premium', imgSrc: map.PREMIUM },
      { value: 'LUXURY',  label: 'Luxury',  imgSrc: map.LUXURY },
    ];
  }
  if (category === 'WOODEN_DOOR') {
    const map = BUDGET_IMAGES.WOODEN_DOOR;
    return [
      { value: 'BUDGET',  label: 'Budget',  imgSrc: map.BUDGET },
      { value: 'PREMIUM', label: 'Premium', imgSrc: map.PREMIUM },
      { value: 'LUXURY',  label: 'Luxury',  imgSrc: map.LUXURY },
    ];
  }
  return [
    { value: 'BUDGET',  label: 'Budget',  imgSrc: null },
    { value: 'PREMIUM', label: 'Premium', imgSrc: null },
    { value: 'LUXURY',  label: 'Luxury',  imgSrc: null },
  ];
}

// Steps: Category → Shape/Type → Budget → Measurements → Customer Details → Result
function visibleSteps(state) {
  const steps = [2];
  if (state.category === 'KITCHEN') {
    steps.push(3);
    if (state.kitchenType === 'ISLAND') steps.push('3b');
  }
  if (state.category === 'WARDROBE') {
    steps.push('3c');
    steps.push('3d');
  }
  steps.push(4, 5, 1, 6);
  return steps;
}

export default function CalculatorPage() {
  const [state, setState] = useState({
    step: 2,
    name: '', email: '', address: '', city: '', phone: '',
    category: null,
    kitchenType: null, islandType: null,
    doorType: null, doorMaterial: null,
    budgetTier: null,
    unit: 'FEET',
    wallA: '', wallB: '', wallC: '',
    length: '', width: '',
  });

  // ── AI Design Studio connection ────────────────────────────
  const [aiImage] = useState(readAiImageFromUrl);   // image coming from AI Studio (if any)

  const [result, setResult] = useState(null);
  const [finalStatus, setFinalStatus] = useState({ text: '', cls: '' });
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setState(prev => ({ ...prev, [key]: value }));

  const steps = visibleSteps(state);
  const currentIdx = steps.indexOf(state.step);

  // Progress dots — count only numeric steps 1-6 for display
  const numericSteps = steps.filter(s => typeof s === 'number').length;
  const doneCount = steps.slice(0, currentIdx + 1).filter(s => typeof s === 'number').length;

  // ── Validation (mirrors validateStep in JS) ────────────────
  function validateStep(stepId) {
    if (stepId === 1) {
      if (!state.name.trim() || !state.email.trim() || !state.address.trim() || !state.phone.trim()) {
        alert('Please fill your name, email, address and WhatsApp number.');
        return false;
      }
    }
    if (stepId === 2 && !state.category) { alert('Please select a category.'); return false; }
    if (stepId === 3 && !state.kitchenType) { alert('Please select a kitchen shape.'); return false; }
    if (stepId === '3b' && !state.islandType) { alert('Please select an island layout.'); return false; }
    if (stepId === '3c' && !state.doorType) { alert('Please select a door type.'); return false; }
    if (stepId === '3d' && !state.doorMaterial) { alert('Please select a door material.'); return false; }
    if (stepId === 4 && !state.budgetTier) { alert('Please select a budget tier.'); return false; }
    if (stepId === 5) {
      if (state.category === 'KITCHEN') {
        const needsC = state.kitchenType === 'U_SHAPE' ||
          (state.kitchenType === 'ISLAND' && state.islandType === 'L_ISLAND');
        if (!state.wallA || !state.wallB || (needsC && !state.wallC)) {
          alert('Please enter valid wall measurements.');
          return false;
        }
      } else {
        if (!state.length || !state.width) {
          alert('Please enter valid length and width.');
          return false;
        }
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep(state.step)) return;
    if (state.step === 6) return;
    if (currentIdx < steps.length - 1) {
      setState(prev => ({ ...prev, step: steps[currentIdx + 1] }));
    }
  }

  function handleBack() {
    if (currentIdx > 0) {
      setState(prev => ({ ...prev, step: steps[currentIdx - 1] }));
    }
  }

  // ── Submit order (mirrors submitOrder() in JS) ─────────────
  async function submitOrder() {
    setLoading(true);
    setResult(null);
    setFinalStatus({ text: '', cls: '' });

    const payload = {
      name: state.name,
      email: state.email,
      address: state.address,
      city: state.city,
      phoneNumber: state.phone,
      category: state.category,
      kitchenType: state.category === 'KITCHEN' ? state.kitchenType : null,
      islandType: (state.category === 'KITCHEN' && state.kitchenType === 'ISLAND') ? state.islandType : null,
      doorType: state.category === 'WARDROBE' ? state.doorType : null,
      doorMaterial: state.category === 'WARDROBE' ? state.doorMaterial : null,
      budgetTier: state.budgetTier,
      unit: state.unit,
      length: state.category !== 'KITCHEN' ? parseFloat(state.length) : null,
      width: state.category !== 'KITCHEN' ? parseFloat(state.width) : null,
      wallA: state.category === 'KITCHEN' ? parseFloat(state.wallA) : null,
      wallB: state.category === 'KITCHEN' ? parseFloat(state.wallB) : null,
      wallC: state.category === 'KITCHEN' ? (state.wallC ? parseFloat(state.wallC) : null) : null,
      designImageUrl: state.category === 'DECOR_WALL' ? aiImage : null,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Unknown error');
      }
      const order = await res.json();
      setResult(order);
      setFinalStatus({ text: 'Your quotation PDF has been generated and sent to your email.', cls: 'ok' });
    } catch (err) {
      setFinalStatus({ text: 'Error: ' + err.message, cls: 'err' });
    } finally {
      setLoading(false);
    }
  }

  // ── Kitchen wall hint text ─────────────────────────────────
  function wallHint() {
    if (state.kitchenType === 'U_SHAPE')
      return 'Enter the length of each of the 3 walls that form your U-shape kitchen.';
    if (state.kitchenType === 'ISLAND' && state.islandType === 'L_ISLAND')
      return 'Wall A & B form the L-shaped counter, Wall C is the island length.';
    if (state.kitchenType === 'ISLAND' && state.islandType === 'STRAIGHT_ISLAND')
      return 'Wall A is your straight counter, Wall B is the island length.';
    return 'Enter the length of each wall (in the chosen unit).';
  }

  const needsWallC = state.kitchenType === 'U_SHAPE' ||
    (state.kitchenType === 'ISLAND' && state.islandType === 'L_ISLAND');

  const budgetOptions = getBudgetImages(state.category, state.kitchenType);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="wizard">
      {/* Progress bar */}
      <div className="progress">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`dot${i < doneCount ? ' done' : ''}`} />
        ))}
      </div>

      {/* ── STEP 1: Customer details ── */}
      {state.step === 1 && (
        <div className="step active">
          <h2>Your details</h2>
          <p className="hint">We'll send your personalised quote to this email & phone.</p>
          <div className="field">
            <label>Full name</label>
            <input id="custName" type="text" placeholder="Enter your full name"
              value={state.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Email address</label>
            <input id="custEmail" type="text" placeholder="Enter your email"
              value={state.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Address</label>
            <input id="custAddress" type="text" placeholder="House no, street, area"
              value={state.address} onChange={e => update('address', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input id="custCity" type="text" placeholder="City"
              value={state.city} onChange={e => update('city', e.target.value)} />
          </div>
          <div className="field">
            <label>WhatsApp number (with country code)</label>
            <input id="custPhone" type="text" placeholder="+919876543210"
              value={state.phone} onChange={e => update('phone', e.target.value)} />
          </div>
        </div>
      )}

      {/* ── STEP 2: Category ── */}
      {state.step === 2 && (
        <div className="step active">
          <h2>What are you looking for?</h2>
          <p className="hint">Choose a category to continue.</p>
          <div className="option-grid" id="categoryGrid">
            <OptionCard value="WARDROBE" label="Wardrobe" imgSrc="/images/wardrobe.jpg"
              selected={state.category === 'WARDROBE'}
              onSelect={v => setState(prev => ({ ...prev, category: v, kitchenType: null, islandType: null, doorType: null, doorMaterial: null }))} />
            <OptionCard value="WOODEN_DOOR" label="Wooden Door" imgSrc="/images/woodendoor.jpg"
              selected={state.category === 'WOODEN_DOOR'}
              onSelect={v => setState(prev => ({ ...prev, category: v, kitchenType: null, islandType: null, doorType: null, doorMaterial: null }))} />
            <OptionCard value="KITCHEN" label="Kitchen" imgSrc="/images/kitchen.jpg"
              selected={state.category === 'KITCHEN'}
              onSelect={v => setState(prev => ({ ...prev, category: v, kitchenType: null, islandType: null, doorType: null, doorMaterial: null }))} />

            {/* ── AI design (Decorative Wall) ── */}
            {aiImage ? (
              <OptionCard value="DECOR_WALL" label="Decorative Wall — Your AI Design" imgSrc={aiImage}
                badge="AI" className="ai-card"
                selected={state.category === 'DECOR_WALL'}
                onSelect={v => setState(prev => ({ ...prev, category: v, kitchenType: null, islandType: null, doorType: null, doorMaterial: null }))} />
            ) : (
              <OptionCard value="AI_LINK" label="Decorative Wall — Design it with AI ✨"
                badge="AI" className="ai-card"
                selected={false}
                onSelect={() => { window.location.href = '/studio/?from=calculator'; }} />
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Kitchen shape ── */}
      {state.step === 3 && (
        <div className="step active">
          <h2>Choose your kitchen shape</h2>
          <p className="hint">Pick the layout closest to your kitchen.</p>
          <div className="option-grid" id="kitchenTypeGrid">
            <OptionCard value="L_SHAPE" label="L-Shape" imgSrc="/images/l_ shape _kitchen.jpg"
              selected={state.kitchenType === 'L_SHAPE'}
              onSelect={v => setState(prev => ({ ...prev, kitchenType: v, islandType: null }))} />
            <OptionCard value="U_SHAPE" label="U-Shape" imgSrc="/images/u _shape.jpg"
              selected={state.kitchenType === 'U_SHAPE'}
              onSelect={v => setState(prev => ({ ...prev, kitchenType: v, islandType: null }))} />
            <OptionCard value="ISLAND" label="Island" imgSrc="/images/island.jpg"
              selected={state.kitchenType === 'ISLAND'}
              onSelect={v => setState(prev => ({ ...prev, kitchenType: v, islandType: null }))} />
            <OptionCard value="PARALLEL" label="Parallel" imgSrc="/images/parellel.jpg"
              selected={state.kitchenType === 'PARALLEL'}
              onSelect={v => setState(prev => ({ ...prev, kitchenType: v, islandType: null }))} />
          </div>
        </div>
      )}

      {/* ── STEP 3b: Island type ── */}
      {state.step === '3b' && (
        <div className="step active">
          <h2>Which island layout?</h2>
          <p className="hint">Choose the island style closest to yours.</p>
          <div className="option-grid" id="islandTypeGrid">
            <OptionCard value="STRAIGHT_ISLAND" label="Straight Island"
              selected={state.islandType === 'STRAIGHT_ISLAND'}
              onSelect={v => update('islandType', v)} />
            <OptionCard value="L_ISLAND" label="L-Island"
              selected={state.islandType === 'L_ISLAND'}
              onSelect={v => update('islandType', v)} />
          </div>
        </div>
      )}

      {/* ── STEP 3c: Door type ── */}
      {state.step === '3c' && (
        <div className="step active">
          <h2>Choose your door type</h2>
          <p className="hint">Pick the wardrobe door style.</p>
          <div className="option-grid" id="doorTypeGrid">
            <OptionCard value="OPENING_DOOR" label="Opening Door"
              selected={state.doorType === 'OPENING_DOOR'}
              onSelect={v => update('doorType', v)} />
            <OptionCard value="SLIDING_DOOR" label="Sliding Door"
              selected={state.doorType === 'SLIDING_DOOR'}
              onSelect={v => update('doorType', v)} />
          </div>
        </div>
      )}

      {/* ── STEP 3d: Door material ── */}
      {state.step === '3d' && (
        <div className="step active">
          <h2>Choose door material</h2>
          <p className="hint">Pick the wardrobe door material.</p>
          <div className="option-grid" id="doorMaterialGrid">
            <OptionCard value="WOODEN" label="Wooden"
              selected={state.doorMaterial === 'WOODEN'}
              onSelect={v => update('doorMaterial', v)} />
            <OptionCard value="GLASS" label="Glass"
              selected={state.doorMaterial === 'GLASS'}
              onSelect={v => update('doorMaterial', v)} />
          </div>
        </div>
      )}

      {/* ── STEP 4: Budget ── */}
      {state.step === 4 && (
        <div className="step active">
          <h2>Choose your budget tier</h2>
          <p className="hint">This determines the material quality and finish.</p>
          <div className="option-grid budget-grid budget-group active" id="budgetGrid">
            {budgetOptions.map(opt => (
              <OptionCard key={opt.value} value={opt.value} label={opt.label} imgSrc={opt.imgSrc}
                selected={state.budgetTier === opt.value}
                onSelect={v => update('budgetTier', v)} />
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 5: Measurements ── */}
      {state.step === 5 && (
        <div className="step active">
          <h2>Enter measurements</h2>
          <p className="hint">Accurate measurements give you the best quote estimate.</p>

          {/* Unit toggle */}
          <div className="unit-toggle">
            {['FEET', 'INCH'].map(u => (
              <button key={u} className={state.unit === u ? 'active' : ''}
                data-unit={u} onClick={() => update('unit', u)}>
                {u === 'FEET' ? 'Feet (ft)' : 'Inches (in)'}
              </button>
            ))}
          </div>

          {/* Kitchen: wall inputs */}
          {state.category === 'KITCHEN' && (
            <div id="wallFields">
              <div className="wall-hint" id="wallHint">{wallHint()}</div>
              <div className="dim-row">
                <div className="field">
                  <label>Wall A ({state.unit === 'FEET' ? 'ft' : 'in'})</label>
                  <input id="wallAInput" type="number" placeholder="e.g. 10"
                    value={state.wallA} onChange={e => update('wallA', e.target.value)} />
                </div>
                <div className="field">
                  <label>{state.kitchenType === 'ISLAND' && state.islandType === 'STRAIGHT_ISLAND' ? 'Counter B' : 'Wall B'} ({state.unit === 'FEET' ? 'ft' : 'in'})</label>
                  <input id="wallBInput" type="number" placeholder="e.g. 8"
                    value={state.wallB} onChange={e => update('wallB', e.target.value)} />
                </div>
                {needsWallC && (
                  <div className="field" id="wallCField">
                    <label>{state.kitchenType === 'ISLAND' ? 'Counter C' : 'Wall C'} ({state.unit === 'FEET' ? 'ft' : 'in'})</label>
                    <input id="wallCInput" type="number" placeholder="e.g. 6"
                      value={state.wallC} onChange={e => update('wallC', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wardrobe / Door: area inputs */}
          {state.category !== 'KITCHEN' && (
            <div id="areaFields" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: '100px' }}>
                <label>{state.category === 'DECOR_WALL' ? 'Wall Length' : 'Length'} ({state.unit === 'FEET' ? 'ft' : 'in'})</label>
                <input id="lengthInput" type="number" placeholder="e.g. 6"
                  value={state.length} onChange={e => update('length', e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: '100px' }}>
                <label>{state.category === 'DECOR_WALL' ? 'Wall Height' : 'Width'} ({state.unit === 'FEET' ? 'ft' : 'in'})</label>
                <input id="widthInput" type="number" placeholder="e.g. 8"
                  value={state.width} onChange={e => update('width', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 6: Result ── */}
      {state.step === 6 && (
        <div className="step active">
          <h2>Your Estimate</h2>
          <p className="hint">Based on your inputs, here is your estimated price.</p>

          {state.category === 'DECOR_WALL' && aiImage && (
            <div className="ai-preview">
              <img src={aiImage} alt="Your AI design" />
              <span>Decorative Wall · Your AI Design</span>
            </div>
          )}

          <div className="result-box" id="resultBox">
            {loading && <div>Calculating your quote...</div>}
            {!loading && !result && !finalStatus.text && (
              <div>Click "Get Quote" to calculate your estimate.</div>
            )}
            {result && (
              <>
                <div>
                  {state.category === 'KITCHEN'
                    ? <>Running feet: <strong>{result.areaSqft?.toFixed(2)}</strong></>
                    : <>Area: <strong>{result.areaSqft?.toFixed(2)} sqft</strong></>
                  }
                </div>
                <div className="price">₹ {result.estimatedPrice?.toLocaleString('en-IN')}</div>

                {(result.pdfUrl || result.pdfPath) && (
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <a
                      href={result.pdfUrl || result.pdfPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '14px 28px',
                        background: 'linear-gradient(135deg, #6f4e37, #3d2b1f)',
                        color: '#ffffff',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '15px',
                        boxShadow: '0 4px 12px rgba(111,78,55,0.3)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      📄 Download / View PDF Quotation
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {finalStatus.text && (
            <div id="finalStatus" className={`status-msg ${finalStatus.cls}`}>
              {finalStatus.text}
            </div>
          )}

          {!result && (
            <div className="nav-row" style={{ justifyContent: 'center', marginTop: '16px' }}>
              <button id="getQuoteBtn" className="primary" onClick={submitOrder} disabled={loading}>
                {loading ? 'Calculating...' : 'Get Quote'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Navigation buttons ── */}
      <div className="nav-row">
        <button id="backBtn" className="secondary"
          onClick={handleBack}
          disabled={currentIdx === 0}>
          ← Back
        </button>

        {state.step !== 6 && (
          <button id="nextBtn" className="primary" onClick={handleNext}>
            {currentIdx === steps.length - 2 ? 'Review →' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}
