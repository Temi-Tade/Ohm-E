/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { ComponentType } from '../types/circuit';
import { StandardSymbolIcon } from './StandardSchematicSymbols';

interface ComponentPaletteProps {
  onAddComponent: (type: ComponentType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface PaletteItem {
  type: ComponentType;
  label: string;
  category: 'sources' | 'passives' | 'semiconductors' | 'controls' | 'meters';
  hint: string;
  symbolLabel?: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Sources
  { type: 'dc_source', label: 'DC Voltage Source', category: 'sources', hint: 'Constant DC potential' },
  { type: 'ac_source', label: 'AC Generator', category: 'sources', hint: 'Sine / Square wave source' },
  { type: 'clock_source', label: 'Pulse Clock', category: 'sources', hint: 'Digital pulse generator' },
  { type: 'ground', label: 'Ground (0V Ref)', category: 'sources', hint: 'Zero-volt reference potential' },

  // Passives
  { type: 'resistor', label: 'Resistor', category: 'passives', hint: 'Linear resistance (Ω)' },
  { type: 'potentiometer', label: 'Potentiometer', category: 'passives', hint: 'Variable 3-terminal divider' },
  { type: 'capacitor', label: 'Capacitor', category: 'passives', hint: 'Electrostatic charge storage (F)' },
  { type: 'inductor', label: 'Inductor', category: 'passives', hint: 'Magnetic flux storage (H)' },

  // Semiconductors
  { type: 'diode', label: 'PN Junction Diode', category: 'semiconductors', hint: 'One-way current rectifier' },
  { type: 'zener_diode', label: 'Zener Diode', category: 'semiconductors', hint: 'Reverse breakdown regulator' },
  { type: 'led', label: 'Light Emitting Diode', category: 'semiconductors', hint: 'Luminescent indicator' },
  { type: 'npn', label: 'NPN BJT Transistor', category: 'semiconductors', hint: 'Bipolar current amplifier' },
  { type: 'pnp', label: 'PNP BJT Transistor', category: 'semiconductors', hint: 'Complementary bipolar transistor' },
  { type: 'n_mosfet', label: 'N-Channel MOSFET', category: 'semiconductors', hint: 'Voltage-controlled N-FET' },
  { type: 'p_mosfet', label: 'P-Channel MOSFET', category: 'semiconductors', hint: 'Voltage-controlled P-FET' },

  // Controls & Active
  { type: 'opamp', label: 'Operational Amplifier', category: 'controls', hint: 'High-gain differential op-amp' },
  { type: 'switch', label: 'SPST Switch', category: 'controls', hint: 'Single-pole single-throw' },
  { type: 'push_button', label: 'Push Button', category: 'controls', hint: 'Normally-open momentary switch' },
  { type: 'buzzer', label: 'Piezo Buzzer', category: 'controls', hint: 'Acoustic audio transducer' },

  // Meters
  { type: 'voltmeter', label: 'Voltmeter', category: 'meters', hint: 'High-Z voltage probe' },
  { type: 'ammeter', label: 'Ammeter', category: 'meters', hint: 'Low-Z series current probe' },
];

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  onAddComponent,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [search, setSearch] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredItems = PALETTE_ITEMS.filter((item) => {
    const matchesSearch =
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.hint.toLowerCase().includes(search.toLowerCase()) ||
      item.type.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const content = (
    <div className="flex flex-col h-full bg-[#15171b] text-[#eceff4] select-none border-r border-[#252831]">
      {/* Header */}
      <div className="p-3 border-b border-[#252831]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#717684]">
            Components Library
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-[#8b909f] hover:text-white hover:bg-[#252831] md:hidden cursor-pointer"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#5e6371] pointer-events-none" />
          <input
            type="text"
            placeholder="Search parts (resistor, diode, opamp...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1e24] border border-[#2b2e37] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[#eceff4] placeholder-[#5e6371] focus:outline-none focus:border-[#4a4f5f] transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-1 mt-2.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'passives', label: 'Passives' },
            { id: 'semiconductors', label: 'Active' },
            { id: 'sources', label: 'Power' },
            { id: 'controls', label: 'Logic & I/O' },
            { id: 'meters', label: 'Meters' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#282b34] text-white font-medium border border-[#3b3f4d]'
                  : 'text-[#8b909f] hover:text-[#dce0e8] hover:bg-[#1f2128]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredItems.map((item) => (
          <button
            key={item.type}
            onClick={() => {
              onAddComponent(item.type);
              if (isOpenMobile && onCloseMobile) {
                onCloseMobile();
              }
            }}
            className="w-full text-left p-2 rounded-md bg-[#1a1c22] hover:bg-[#22252e] active:bg-[#16181e] border border-[#262832] hover:border-[#383c4a] transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Standard Schematic Symbol Icon */}
              <div className="w-8 h-8 rounded-md bg-[#121317] border border-[#242630] flex items-center justify-center shrink-0 text-[#9ca1af] group-hover:text-white transition-colors">
                <StandardSymbolIcon type={item.type} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#dce0e8] group-hover:text-white transition-colors truncate">
                  {item.label}
                </div>
                <div className="text-[10px] text-[#717684] truncate">{item.hint}</div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-[#5e6371] group-hover:text-[#a0a5b4] shrink-0 ml-2">
              +
            </span>
          </button>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-xs text-[#717684]">
            No components match &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Permanent Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#15171b] flex-col select-none shrink-0">
        {content}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[85vw] h-full bg-[#15171b] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
