import { useState, useEffect } from 'react';

/**
 * AdminPage.jsx
 * 1:1 port of admin.html
 * Rate Manager — view, add, edit, delete price configurations.
 * Protected by HTTP Basic Auth (browser popup — handled by backend middleware).
 */

const API_BASE = '/api/admin/price-config';

function formatLabel(value) {
  if (!value) return '—';
  if (value === 'DECOR_WALL') return 'Decorative Wall';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminPage() {
  const [rates, setRates] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [addStatus, setAddStatus] = useState({ text: '', cls: '' });

  // Form state — mirrors addForm in admin.html
  const [form, setForm] = useState({
    category: 'WARDROBE',
    kitchenType: '',
    islandType: '',
    doorType: '',
    doorMaterial: '',
    budgetTier: 'PREMIUM',
    ratePerUnit: '',
  });

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState('');

  useEffect(() => {
    loadRates();
  }, []);

  async function loadRates() {
    setLoadErr('');
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load rates');
      const data = await res.json();
      setRates(data);
    } catch (err) {
      setLoadErr('Could not load rates: ' + err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddStatus({ text: '', cls: '' });

    if (form.category === 'KITCHEN' && !form.kitchenType) {
      setAddStatus({ text: 'Please select a kitchen type.', cls: 'err' });
      return;
    }

    const payload = {
      category: form.category,
      kitchenType: form.category === 'KITCHEN' ? (form.kitchenType || null) : null,
      islandType: (form.category === 'KITCHEN' && form.kitchenType === 'ISLAND') ? (form.islandType || null) : null,
      doorType: form.category === 'WARDROBE' ? (form.doorType || null) : null,
      doorMaterial: form.category === 'WARDROBE' ? (form.doorMaterial || null) : null,
      budgetTier: form.budgetTier,
      ratePerUnit: parseFloat(form.ratePerUnit),
    };

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Add failed');
      setAddStatus({ text: 'Rate added successfully.', cls: 'ok' });
      setForm({ category: 'WARDROBE', kitchenType: '', islandType: '', doorType: '', doorMaterial: '', budgetTier: 'PREMIUM', ratePerUnit: '' });
      loadRates();
    } catch (err) {
      setAddStatus({ text: 'Could not add rate: ' + err.message, cls: 'err' });
    }
  }

  async function handleUpdate(id) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePerUnit: parseFloat(editRate) }),
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingId(null);
      loadRates();
    } catch (err) {
      alert('Could not update rate: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this rate?')) return;
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadRates();
    } catch (err) {
      alert('Could not delete rate: ' + err.message);
    }
  }

  return (
    <div className="admin-body">
      <header>
        <h1>Rate Manager</h1>
        <span className="tag">furniture-calculator / admin</span>
      </header>

      <main>
        {/* ── Add form ── */}
        <div className="panel">
          <h2>Add a new rate</h2>
          <form id="addForm" onSubmit={handleAdd}>
            <div className="field">
              <label>Category</label>
              <select id="category" value={form.category} required
                onChange={e => setForm(f => ({ ...f, category: e.target.value, kitchenType: '', islandType: '', doorType: '', doorMaterial: '' }))}>
                <option value="WARDROBE">Wardrobe</option>
                <option value="WOODEN_DOOR">Wooden Door</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="DECOR_WALL">Decorative Wall (AI design)</option>
              </select>
              {form.category === 'DECOR_WALL' && (
                <small style={{ display: 'block', marginTop: 6, opacity: 0.75 }}>
                  Rate is per sqft (wall length × wall height). Add one rate each for Budget, Premium and Luxury.
                </small>
              )}
            </div>

            {form.category === 'KITCHEN' && (
              <div className="field" id="kitchenTypeField">
                <label>Kitchen Type</label>
                <select id="kitchenType" value={form.kitchenType}
                  onChange={e => setForm(f => ({ ...f, kitchenType: e.target.value, islandType: '' }))}>
                  <option value="">— select —</option>
                  <option value="L_SHAPE">L-Shape</option>
                  <option value="U_SHAPE">U-Shape</option>
                  <option value="ISLAND">Island</option>
                  <option value="PARALLEL">Parallel</option>
                </select>
              </div>
            )}

            {form.category === 'KITCHEN' && form.kitchenType === 'ISLAND' && (
              <div className="field">
                <label>Island Type</label>
                <select id="islandType" value={form.islandType}
                  onChange={e => setForm(f => ({ ...f, islandType: e.target.value }))}>
                  <option value="">— select —</option>
                  <option value="STRAIGHT_ISLAND">Straight Island</option>
                  <option value="L_ISLAND">L-Island</option>
                </select>
              </div>
            )}

            {form.category === 'WARDROBE' && (
              <>
                <div className="field">
                  <label>Door Type</label>
                  <select id="doorType" value={form.doorType}
                    onChange={e => setForm(f => ({ ...f, doorType: e.target.value }))}>
                    <option value="">— select —</option>
                    <option value="OPENING_DOOR">Opening Door</option>
                    <option value="SLIDING_DOOR">Sliding Door</option>
                  </select>
                </div>
                <div className="field">
                  <label>Door Material</label>
                  <select id="doorMaterial" value={form.doorMaterial}
                    onChange={e => setForm(f => ({ ...f, doorMaterial: e.target.value }))}>
                    <option value="">— select —</option>
                    <option value="WOODEN">Wooden</option>
                    <option value="GLASS">Glass</option>
                  </select>
                </div>
              </>
            )}

            <div className="field">
              <label>Budget Tier</label>
              <select id="budgetTier" value={form.budgetTier} required
                onChange={e => setForm(f => ({ ...f, budgetTier: e.target.value }))}>
                <option value="BUDGET">Budget</option>
                <option value="PREMIUM">Premium</option>
                <option value="LUXURY">Luxury</option>
              </select>
            </div>

            <div className="field">
              <label>Rate (₹ / sqft or running ft)</label>
              <input id="ratePerSqft" type="number" step="0.01" min="0" required
                placeholder="e.g. 1500"
                value={form.ratePerUnit}
                onChange={e => setForm(f => ({ ...f, ratePerUnit: e.target.value }))} />
            </div>

            <div className="field">
              <button type="submit">Add Rate</button>
            </div>
          </form>
          <div id="addStatus" className={`status${addStatus.cls ? ' ' + addStatus.cls : ''}`}>
            {addStatus.text}
          </div>
        </div>

        {/* ── Rates table ── */}
        <div className="panel">
          <h2>Current Rates</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Kitchen Type</th>
                <th>Island Type</th>
                <th>Door Type</th>
                <th>Door Material</th>
                <th>Budget Tier</th>
                <th>Rate (₹/unit)</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="rateTableBody">
              {loadErr && (
                <tr><td colSpan="8" className="empty">{loadErr}</td></tr>
              )}
              {!loadErr && rates.length === 0 && (
                <tr><td colSpan="8" className="empty">No rates configured yet. Add one above.</td></tr>
              )}
              {rates.map(rate => (
                <tr key={rate.id}>
                  <td className="tag-cell">{formatLabel(rate.category)}</td>
                  <td className="tag-cell">{formatLabel(rate.kitchenType)}</td>
                  <td className="tag-cell">{formatLabel(rate.islandType)}</td>
                  <td className="tag-cell">{formatLabel(rate.doorType)}</td>
                  <td className="tag-cell">{formatLabel(rate.doorMaterial)}</td>
                  <td className="tag-cell">{formatLabel(rate.budgetTier)}</td>
                  <td>
                    <input
                      type="number"
                      className="rate-input"
                      step="0.01"
                      min="0"
                      data-id={rate.id}
                      value={editingId === rate.id ? editRate : rate.ratePerUnit}
                      readOnly={editingId !== rate.id}
                      onChange={e => setEditRate(e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="action-cell">
                      {editingId !== rate.id ? (
                        <button className="edit" data-id={rate.id}
                          onClick={() => { setEditingId(rate.id); setEditRate(String(rate.ratePerUnit)); }}>
                          Edit
                        </button>
                      ) : (
                        <button className="save" data-id={rate.id}
                          onClick={() => handleUpdate(rate.id)}>
                          Save
                        </button>
                      )}
                      <button className="danger" data-id={rate.id}
                        onClick={() => handleDelete(rate.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
