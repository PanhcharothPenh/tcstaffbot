/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart3, 
  Layers, 
  Users, 
  DollarSign, 
  Calendar, 
  Coins, 
  CreditCard, 
  Wrench, 
  Package, 
  FileText, 
  Settings, 
  ShieldCheck,
  UserCheck,
  Menu,
  X,
  Flame,
  Droplets,
  Sparkle,
  Boxes,
  Truck,
  Lock,
  Wallet,
  FileCheck,
  History,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  Star,
  Send,
  Bot,
  CalendarDays,
  Coffee,
  MapPin,
  Building2,
  LayoutDashboard
} from 'lucide-react';
import { Role, User, Branch } from '../types';
import { translations } from '../mockData';
import TCLogo from './TCLogo';

interface SidebarProps {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  branches: Branch[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'en' | 'kh';
  setLang: (lang: 'en' | 'kh') => void;
  exchangeRate: number;
  onLogout?: () => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean | ((prev: boolean) => boolean)) => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  currentRole,
  setCurrentRole,
  currentUser,
  setCurrentUser,
  users,
  activeBranchId,
  setActiveBranchId,
  branches,
  activeTab,
  setActiveTab,
  lang,
  setLang,
  onLogout,
  isCollapsed = false,
  setIsCollapsed,
  onCloseMobile
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('coffee_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'string');
        }
      }
    } catch {
      // safe fallback
    }
    return [];
  });

  const toggleFavorite = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const updated = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      try {
        localStorage.setItem('coffee_favorites', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };
  
  const t = translations[lang];

  // Navigation Items Definitions - Pure Staff Management Suite
  const navItems = [
    { id: 'staff', label: lang === 'en' ? 'Staff & Baristas' : 'បុគ្គលិក & Barista', icon: Users, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'shifts', label: lang === 'en' ? 'Shift Roster Calendar' : 'ប្រតិទិនវេនការងារ', icon: CalendarDays, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'attendance', label: t.attendance, icon: Calendar, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'salary', label: t.salary, icon: DollarSign, roles: ['Owner', 'Admin', 'Manager', 'Staff'] },
    { id: 'branches', label: lang === 'en' ? 'Branch & GPS Setup' : 'សាខា & ទីតាំងស្កេន GPS', icon: MapPin, roles: ['Owner', 'Admin'] },
    { id: 'users', label: lang === 'en' ? 'User Accounts & Roles' : 'គណនី & សិទ្ធិប្រើប្រាស់', icon: ShieldCheck, roles: ['Owner', 'Admin'] }
  ];

  const navGroups = [
    {
      title: lang === 'en' ? 'Staff & Payroll Management' : 'គ្រប់គ្រងបុគ្គលិក និងប្រាក់ខែ',
      icon: Users,
      items: ['staff', 'shifts', 'attendance', 'salary', 'branches', 'users']
    }
  ];

  // Helper to filter branches accessible by selected user role
  const getAccessibleBranches = () => {
    if (currentUser?.assignedBranchIds && currentUser.assignedBranchIds.length > 0) {
      return branches.filter(b => currentUser.assignedBranchIds?.includes(b.id));
    }
    return branches;
  };

  const accessibleBranches = getAccessibleBranches();

  // Handle physical user swap when switching simulated roles
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as Role;
    setCurrentRole(nextRole);
    
    const match = users.find(u => u.role === nextRole);
    if (match) {
      setCurrentUser(match);
    }

    if (nextRole === 'Manager' || nextRole === 'Staff') {
      setActiveBranchId('b1');
    } else if (nextRole === 'Admin') {
      setActiveBranchId('b1');
    } else {
      setActiveBranchId('all');
    }
  };

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  const isGroupExpanded = (groupTitle: string) => {
    if (searchQuery.trim() !== '') return true;
    return !collapsedGroups[groupTitle];
  };

  // Filter groups and items based on search and roles
  const filteredGroups = navGroups.map(group => {
    const visibleItems = group.items
      .map(itemId => navItems.find(item => item.id === itemId))
      .filter((item): item is typeof navItems[0] => {
        if (!item) return false;
        
        // Check role access
        const hasAccess = item.roles.includes(currentRole);
        if (!hasAccess) return false;
        
        // Check search query
        if (searchQuery.trim() === '') return true;
        const query = searchQuery.toLowerCase();
        return (
          item.label.toLowerCase().includes(query) ||
          group.title.toLowerCase().includes(query)
        );
      });

    return {
      ...group,
      visibleItems
    };
  }).filter(group => group.visibleItems.length > 0);

  // Filter favorites based on search, role, and active selections
  const favoriteItems = navItems.filter(item => {
    if (!favorites.includes(item.id)) return false;
    const hasAccess = item.roles.includes(currentRole);
    if (!hasAccess) return false;
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    return item.label.toLowerCase().includes(query);
  });

  const favoritesExpanded = isGroupExpanded('clean24_favorites_group');

  return (
    <aside className={`h-full bg-white text-slate-800 border-r border-slate-200/80 flex flex-col justify-between overflow-hidden shadow-xs transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-72'}`}>
      
      {/* 1. TOP HEADER BRANDING BLOCK */}
      <div className="relative p-3.5 border-b border-slate-200/80 bg-white shrink-0">
        
        {!isCollapsed ? (
          <>
            {/* Mobile close button positioned in top-right */}
            {onCloseMobile && (
              <button 
                onClick={onCloseMobile}
                className="lg:hidden absolute right-2.5 top-2.5 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 cursor-pointer transition-colors z-20"
                aria-label="Close Navigation"
              >
                <X size={18} />
              </button>
            )}

            {/* Centered & Big Brand Logo */}
            <div className="flex flex-col items-center justify-center text-center w-full py-1">
              <TCLogo className="h-20 sm:h-24 cursor-pointer hover:scale-102 transition-transform" />
            </div>

            {/* Active Branch Select Form */}
            <div className="mt-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[9px] text-blue-700 uppercase tracking-widest block font-extrabold flex items-center gap-1">
                  <Building2 size={11} className="text-blue-600" />
                  {t.activeBranch}
                </label>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </div>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs text-slate-800 rounded-xl p-2 focus:outline-none focus:border-blue-500 font-sans cursor-pointer transition-colors font-bold shadow-xs"
              >
                {(currentRole === 'Owner' || currentRole === 'Admin') && (!currentUser?.assignedBranchIds || currentUser.assignedBranchIds.length === 0) && (
                  <option value="all">🏢 {t.allBranches}</option>
                )}
                {accessibleBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    📍 {b.branchName}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* COLLAPSED HEADER: Centered Brand Logo / Toggle Button */
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => setIsCollapsed && setIsCollapsed(!isCollapsed)}
              className="w-13 h-13 hover:bg-slate-100 p-1.5 rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 group"
              title="Expand Sidebar"
            >
              <img src="/logo.png" alt="TC Staff" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
            </button>
          </div>
        )}

      </div>

      {/* 2. SEARCH MENU FILTER BAR (When expanded) */}
      {!isCollapsed && (
        <div className="px-3.5 py-2.5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'en' ? "Search staff modules..." : "ស្វែងរកមុខងារបុគ្គលិក..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-8.5 pr-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white font-sans transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. DYNAMIC NAVIGATION TABS LIST */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-8 space-y-3 custom-scrollbar bg-slate-50/50">
        
        {/* COLLAPSED MODE: Clean Icons with Tooltip Popup */}
        {isCollapsed ? (
          <div className="space-y-2 flex flex-col items-center">
            {navItems.filter(item => item.roles.includes(currentRole)).map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group ${
                    active 
                      ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400/30' 
                      : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  <item.icon size={19} className="stroke-[2.2]" />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-14 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* EXPANDED MODE: Full Original Menu Feed */
          <>
            {/* Favorites Collapsible Group */}
            {favorites.length > 0 && (
              <div className="space-y-1 border-b border-slate-200/80 pb-3">
                <button
                  onClick={() => toggleGroup('clean24_favorites_group')}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-black text-blue-700 uppercase tracking-widest hover:text-blue-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Star size={11} className="fill-blue-500 text-blue-500 shrink-0" />
                    <span>{lang === 'en' ? 'Favorites' : 'សំណព្វចិត្ត'}</span>
                    <span className="text-[8px] text-slate-400 font-medium lowercase tracking-normal">
                      ({favoriteItems.length})
                    </span>
                  </div>
                  {favoritesExpanded ? <ChevronDown size={10} className="text-blue-600" /> : <ChevronRight size={10} className="text-blue-600" />}
                </button>

                {favoritesExpanded && (
                  <div className="space-y-1 pl-1 fade-in-slide">
                    {favoriteItems.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={`fav-${item.id}`}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            if (onCloseMobile) onCloseMobile();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                            ${active 
                              ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white font-bold shadow-sm shadow-blue-500/20 border border-blue-400/20' 
                              : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                            }
                          `}
                          id={`fav_tab_${item.id}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <item.icon size={17} className={active ? 'text-white' : 'text-slate-400 group-hover/item:text-blue-600 shrink-0'} />
                            <span className="truncate text-xs font-bold flex-1 text-left">{item.label}</span>
                          </div>
                          <span 
                            onClick={(e) => toggleFavorite(item.id, e)}
                            className="p-1 rounded-md hover:bg-slate-200/70 cursor-pointer transition-colors shrink-0"
                          >
                            <Star 
                              size={15} 
                              className="fill-blue-500 text-blue-500" 
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {filteredGroups.map((group) => {
              const expanded = isGroupExpanded(group.title);
              return (
                <div key={group.title} className="space-y-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <group.icon size={12} className="text-slate-400 shrink-0" />
                      <span>{group.title}</span>
                      <span className="text-[8px] text-slate-400 font-medium lowercase tracking-normal">
                        ({group.visibleItems.length})
                      </span>
                    </div>
                    {expanded ? <ChevronDown size={11} className="text-slate-400" /> : <ChevronRight size={11} className="text-slate-400" />}
                  </button>

                  {/* Group Items */}
                  {expanded && (
                    <div className="space-y-1 pl-1 fade-in-slide">
                      {group.visibleItems.map((item) => {
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              if (onCloseMobile) onCloseMobile();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 focus:outline-none cursor-pointer group/item
                              ${active 
                                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white font-black shadow-sm shadow-blue-500/20 border border-blue-400/20' 
                                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                              }
                            `}
                            id={`nav_tab_${item.id}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.icon size={17} className={active ? 'text-white stroke-[2.5]' : 'text-slate-400 group-hover/item:text-blue-600 shrink-0'} />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <span 
                              onClick={(e) => toggleFavorite(item.id, e)}
                              className="p-1 rounded-md hover:bg-slate-200/70 cursor-pointer transition-colors shrink-0"
                            >
                              <Star 
                                size={15} 
                                className={favorites.includes(item.id) 
                                  ? 'fill-blue-500 text-blue-500' 
                                  : 'text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity'
                                } 
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

      </div>

    </aside>
  );
}
