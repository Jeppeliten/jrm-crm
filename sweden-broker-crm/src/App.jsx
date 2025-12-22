import React, { useState, useMemo, useEffect } from 'react';
import {
    Users,
    BarChart3,
    Search,
    Filter,
    ChevronRight,
    Mail,
    Target,
    DollarSign,
    X,
    Building2,
    Briefcase,
    MapPin,
    MessageSquare,
    Layers,
    ArrowRight,
    Columns,
    CheckSquare,
    Plus,
    Calendar,
    User2,
    Edit3,
    Trash2,
    Save
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import brokerData from './data/brokers.json';

// --- Components ---
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content animate-fade" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
};

const App = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const [brokers, setBrokers] = useState(brokerData);

    // Modals state
    const [selectedBroker, setSelectedBroker] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [selectedChain, setSelectedChain] = useState(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isNewProspectModalOpen, setIsNewProspectModalOpen] = useState(false);
    const [prospectSearch, setProspectSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(null); // 'chain', 'company', 'broker'
    const [user, setUser] = useState(null);
    const [isProduction, setIsProduction] = useState(false);

    // Mock Business States (Azure/MongoDB preparation)
    const [tasks, setTasks] = useState([
        { id: 1, title: 'Ring Andersson HB ang. centralt avtal', dueDate: '2024-12-24', status: 'pending', assignedTo: 'Mig', entity: 'Andersson HB' },
        { id: 2, title: 'Följ upp licenser på Johansson AB', dueDate: '2024-12-23', status: 'completed', assignedTo: 'Kollega', entity: 'Johansson AB' }
    ]);

    const [pipeline, setPipeline] = useState({
        prospect: ['Larsson AB', 'Nilsson AB'],
        contacted: ['Andersson HB'],
        negotiation: [],
        closed: ['Johansson HB']
    });

    // Persistence
    const [comments, setComments] = useState(() => {
        const saved = localStorage.getItem('crm_comments');
        return saved ? JSON.parse(saved) : {};
    });

    const saveComment = (id, text) => {
        const newComments = { ...comments, [id]: text };
        setComments(newComments);
        localStorage.setItem('crm_comments', JSON.stringify(newComments));
    };

    // --- Azure Cloud Sync ---
    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                // Check if we are in Azure (SWA)
                const authRes = await fetch('/.auth/me');
                const authData = await authRes.json();

                if (authData?.clientPrincipal) {
                    setUser(authData.clientPrincipal);
                    setIsProduction(true);

                    // Fetch live data from Azure Functions
                    const brokersRes = await fetch('/api/getBrokers');
                    if (brokersRes.ok) {
                        const cloudBrokers = await brokersRes.json();
                        if (cloudBrokers.length > 0) setBrokers(cloudBrokers);
                    }

                    const tasksRes = await fetch('/api/getTasks');
                    if (tasksRes.ok) {
                        const cloudTasks = await tasksRes.json();
                        setTasks(cloudTasks);
                    }
                }
            } catch (err) {
                console.log("Running in local mode - using mock data.");
            }
        };
        checkAuthAndFetch();
    }, []);

    // --- Data Processing (The Hierarchy with Refined Chain Logic) ---
    const hierarchy = useMemo(() => {
        const chainsMap = {};
        const companiesMap = {};

        brokers.forEach(b => {
            const companyName = b.brokerage;
            // A "true" brand should eventually have multiple companies. 
            // We'll first map everything, then filter.
            const rawBrand = b.brand || 'Oberoende';

            // Resolve Customer Number
            const currentCustNr = b.isActive ? b.customerNumber : null;

            // Init Company
            if (!companiesMap[companyName]) {
                companiesMap[companyName] = {
                    name: companyName,
                    rawBrand: rawBrand,
                    brokers: [],
                    totalCost: 0,
                    activeCount: 0,
                    city: b.city,
                    customerNumber: null
                };
            }
            companiesMap[companyName].brokers.push(b);
            if (b.isActive) {
                companiesMap[companyName].activeCount++;
                companiesMap[companyName].totalCost += b.cost;
                if (currentCustNr && !companiesMap[companyName].customerNumber) {
                    companiesMap[companyName].customerNumber = currentCustNr;
                }
            }
        });

        // Group companies by brand to identify true chains
        const brandGroups = {};
        Object.values(companiesMap).forEach(comp => {
            if (!brandGroups[comp.rawBrand]) brandGroups[comp.rawBrand] = [];
            brandGroups[comp.rawBrand].push(comp);
        });

        // Only define as "Chain" if more than 1 company exists for that brand
        // exception: keep "Oberoende" as a special category if needed, but usually 1-office = just a Company.
        Object.entries(brandGroups).forEach(([brandName, comps]) => {
            if (comps.length > 1 && brandName !== 'Oberoende') {
                chainsMap[brandName] = {
                    name: brandName,
                    companies: new Set(comps.map(c => c.name)),
                    brokers: comps.flatMap(c => c.brokers),
                    totalCost: comps.reduce((acc, c) => acc + c.totalCost, 0),
                    activeCount: comps.reduce((acc, c) => acc + c.activeCount, 0),
                    customerNumber: comps.find(c => c.customerNumber)?.customerNumber || null
                };
            }
        });

        const chains = Object.values(chainsMap).map(c => ({
            ...c,
            companyCount: c.companies.size,
            brokerCount: c.brokers.length,
            isCustomer: c.activeCount > 0
        })).sort((a, b) => b.totalCost - a.totalCost);

        const companies = Object.values(companiesMap).map(c => {
            const isPartOfChain = chainsMap[c.rawBrand];
            return {
                ...c,
                chain: isPartOfChain ? c.rawBrand : 'Oberoende',
                brokerCount: c.brokers.length,
                isCustomer: c.activeCount > 0
            };
        }).sort((a, b) => b.totalCost - a.totalCost);

        // Map brokers with inherited IDs
        const allProcessedBrokers = brokers.map(b => {
            const company = companiesMap[b.brokerage];
            const chain = chainsMap[b.brand]; // Only find if it's a "true" chain
            return {
                ...b,
                brand: chain ? b.brand : 'Oberoende',
                inheritedCustomerNumber: chain?.customerNumber || company?.customerNumber || null
            };
        });

        return { chains, companies, brokers: allProcessedBrokers };
    }, [brokers]);

    // --- Actions (CRUD) ---
    const deleteBroker = (id) => {
        if (window.confirm('Är du säker på att du vill ta bort denna mäklare?')) {
            setBrokers(brokers.filter(b => b.id !== id));
            setSelectedBroker(null);
        }
    };

    const deleteCompany = (name) => {
        if (window.confirm(`Är du säker på att du vill ta bort ${name} och alla dess mäklare?`)) {
            setBrokers(brokers.filter(b => b.brokerage !== name));
            setSelectedCompany(null);
        }
    };

    const deleteChain = (name) => {
        if (window.confirm(`Är du säker på att du vill ta bort hela kedjan ${name} och alla anslutna företag?`)) {
            setBrokers(brokers.filter(b => b.brand !== name));
            setSelectedChain(null);
        }
    };

    const updateBroker = (updatedBroker) => {
        setBrokers(brokers.map(b => b.id === updatedBroker.id ? updatedBroker : b));
    };

    const createBroker = (newBroker) => {
        const id = Math.random().toString(36).substr(2, 9);
        setBrokers([{ ...newBroker, id }, ...brokers]);
    };

    // --- Filtering ---
    const filteredChains = useMemo(() => {
        return hierarchy.chains.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, hierarchy.chains]);

    const filteredCompanies = useMemo(() => {
        return hierarchy.companies.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.chain.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.city.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, hierarchy.companies]);

    const filteredBrokers = useMemo(() => {
        return hierarchy.brokers.filter(b =>
            `${b.firstName} ${b.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.brokerage.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.inheritedCustomerNumber && b.inheritedCustomerNumber.toString().includes(searchTerm))
        ).slice(0, 100);
    }, [searchTerm, hierarchy.brokers]);

    // --- Stats ---
    const stats = useMemo(() => {
        const totalBrokers = hierarchy.brokers.length;
        const activeBrokers = hierarchy.brokers.filter(b => b.isActive).length;
        const totalCompanies = hierarchy.companies.length;
        const activeCompanies = hierarchy.companies.filter(c => c.isCustomer).length;
        const revenue = hierarchy.chains.reduce((acc, c) => acc + c.totalCost, 0);

        return { totalBrokers, activeBrokers, totalCompanies, activeCompanies, revenue };
    }, [hierarchy]);

    const brandChartData = hierarchy.chains.slice(0, 8).map(c => ({ name: c.name, value: c.brokerCount }));

    return (
        <div className="app-container">
            <nav className="sidebar">
                <div className="logo" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
                    <Target size={32} />
                    <span>MäklarCRM Hub</span>
                </div>

                <ul className="nav-links">
                    <li>
                        <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                            <BarChart3 size={20} /> Översikt
                        </a>
                    </li>
                    <li className="nav-divider">Säljverktyg</li>
                    <li>
                        <a className={`nav-item ${activeTab === 'board' ? 'active' : ''}`} onClick={() => setActiveTab('board')}>
                            <Columns size={20} /> Säljtavla
                        </a>
                    </li>
                    <li>
                        <a className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                            <CheckSquare size={20} /> Uppgifter <span className="sidebar-count warning">{tasks.filter(t => t.status === 'pending').length}</span>
                        </a>
                    </li>
                    <li className="nav-divider">Marknadsdata</li>
                    <li>
                        <a className={`nav-item ${activeTab === 'chains' ? 'active' : ''}`} onClick={() => setActiveTab('chains')}>
                            <Briefcase size={20} /> Kedjor <span className="sidebar-count">{hierarchy.chains.length}</span>
                        </a>
                    </li>
                    <li>
                        <a className={`nav-item ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}>
                            <Building2 size={20} /> Företag <span className="sidebar-count">{hierarchy.companies.length}</span>
                        </a>
                    </li>
                    <li>
                        <a className={`nav-item ${activeTab === 'brokers' ? 'active' : ''}`} onClick={() => setActiveTab('brokers')}>
                            <Users size={20} /> Mäklare <span className="sidebar-count">{hierarchy.brokers.length}</span>
                        </a>
                    </li>
                </ul>

                <div className="sidebar-footer">
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Säljvy Hirarki</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Kedja <ArrowRight size={12} /> Företag <ArrowRight size={12} /> Mäklare
                    </div>
                </div>
            </nav>

            <main className="main-content">
                <header className="main-header">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Sök i hela hirarkin..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="user-profile">
                        <div className="user-info">
                            <span className="user-name">{user ? (user.userDetails || user.userId) : 'Gäst (Ej inloggad)'}</span>
                            <span className="user-status">{user ? 'Entra ID Inloggad' : <a href="/.auth/login/aad" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Logga in</a>}</span>
                        </div>
                        <div className="avatar">{user ? (user.userDetails || 'U')[0].toUpperCase() : 'G'}</div>
                    </div>
                </header>

                {activeTab === 'dashboard' && (
                    <div className="animate-fade">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Total Årlig Run Rate</div>
                                <div className="stat-value" style={{ color: 'var(--accent)' }}>{Math.round(stats.revenue).toLocaleString()} kr</div>
                                <div className="stat-sub">Baserat på aktiva licenser</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Betalande Företag</div>
                                <div className="stat-value">{stats.activeCompanies} / {stats.totalCompanies}</div>
                                <div className="stat-bar"><div style={{ width: `${(stats.activeCompanies / stats.totalCompanies) * 100}%` }}></div></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Användare (Mäklare)</div>
                                <div className="stat-value">{stats.activeBrokers} / {stats.totalBrokers}</div>
                                <div className="stat-sub">{stats.totalBrokers - stats.activeBrokers} Leads tillgängliga</div>
                            </div>
                        </div>

                        <div className="data-section">
                            <h3>Marknadsdominans (Mäklare per Kedja)</h3>
                            <div style={{ height: 350, marginTop: '2rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={brandChartData}>
                                        <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} angle={-30} textAnchor="end" height={70} />
                                        <YAxis stroke="#94A3B8" fontSize={11} />
                                        <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '12px' }} />
                                        <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} onClick={(d) => { setSelectedChain(hierarchy.chains.find(c => c.name === d.name)); }} style={{ cursor: 'pointer' }} />
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--primary)" />
                                                <stop offset="100%" stopColor="var(--secondary)" />
                                            </linearGradient>
                                        </defs>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'board' && (
                    <div className="animate-fade">
                        <div className="board-header">
                            <div>
                                <h2>Säljtavla</h2>
                                <p className="text-muted">Kopplat till Azure Cosmos DB (Simulering)</p>
                            </div>
                            <button className="primary-btn" onClick={() => setIsNewProspectModalOpen(true)}><Plus size={18} /> Planera ny bearbetning</button>
                        </div>

                        <div className="kanban-grid">
                            {Object.entries({
                                'prospect': 'Prospekt',
                                'contacted': 'Kontaktad',
                                'negotiation': 'Förhandling',
                                'closed': 'Affär Vunnen'
                            }).map(([key, label]) => (
                                <div key={key} className="kanban-column">
                                    <div className="column-header">
                                        <h4>{label}</h4>
                                        <span className="count">{pipeline[key].length}</span>
                                    </div>
                                    <div className="kanban-list">
                                        {pipeline[key].map(name => {
                                            const comp = hierarchy.companies.find(c => c.name === name);
                                            return (
                                                <div key={name} className="kanban-card" onClick={() => setSelectedCompany(comp)}>
                                                    <div className="card-title">{name}</div>
                                                    <div className="card-meta">
                                                        <span><Building2 size={12} /> {comp?.brokerCount} mäklare</span>
                                                        <span><MapPin size={12} /> {comp?.city}</span>
                                                    </div>
                                                    <div className="card-footer">
                                                        <div className="owner-avatar">J</div>
                                                        <span className="priority">Hög</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {pipeline[key].length === 0 && <div className="empty-slot">Inga objekt här</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="animate-fade">
                        <div className="board-header">
                            <h2>Mina Uppgifter</h2>
                            <button className="primary-btn" onClick={() => setIsTaskModalOpen(true)}><Plus size={18} /> Skapa Uppgift</button>
                        </div>

                        <div className="task-list-container">
                            {tasks.map(task => (
                                <div key={task.id} className={`task-item ${task.status}`}>
                                    <div className="task-checkbox" onClick={() => {
                                        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t));
                                    }}>
                                        {task.status === 'completed' && <div className="check-dot" />}
                                    </div>
                                    <div className="task-content">
                                        <div className="task-title">{task.title}</div>
                                        <div className="task-meta">
                                            <span><Calendar size={12} /> {task.dueDate}</span>
                                            <span><Briefcase size={12} /> {task.entity}</span>
                                            <span><User2 size={12} /> {task.assignedTo}</span>
                                        </div>
                                    </div>
                                    <button className="mini-action-btn">Redigera</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'chains' && (
                    <div className="animate-fade">
                        <div className="board-header">
                            <h2>Fastighetsmäklarkedjor</h2>
                            <button className="primary-btn" onClick={() => setShowCreateModal('chain')}><Plus size={18} /> Ny Kedja</button>
                        </div>
                        <div className="grid-list">
                            {filteredChains.map(chain => (
                                <div key={chain.name} className={`hirarchy-card ${chain.isCustomer ? 'is-customer' : ''}`} onClick={() => setSelectedChain(chain)}>
                                    <div className="card-top">
                                        <Briefcase size={24} className="icon" />
                                        <span className={`status-pill ${chain.isCustomer ? 'active' : 'lead'}`}>
                                            {chain.isCustomer ? 'KUND' : 'LEAD'}
                                        </span>
                                    </div>
                                    <h3>{chain.name}</h3>
                                    <div className="card-metrics">
                                        <div className="metric">
                                            <label>Företag</label>
                                            <span>{chain.companyCount}</span>
                                        </div>
                                        <div className="metric">
                                            <label>Mäklare</label>
                                            <span>{chain.brokerCount}</span>
                                        </div>
                                        <div className="metric">
                                            <label>Intäkt</label>
                                            <span>{Math.round(chain.totalCost).toLocaleString()} kr</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'companies' && (
                    <div className="animate-fade">
                        <div className="board-header">
                            <h2>Anslutna Företag (Kontor)</h2>
                            <button className="primary-btn" onClick={() => setShowCreateModal('company')}><Plus size={18} /> Nytt Företag</button>
                        </div>
                        <div className="data-section" style={{ padding: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Företagsnamn</th>
                                        <th>Kedja</th>
                                        <th>Ort</th>
                                        <th>Mäklare</th>
                                        <th>Status</th>
                                        <th>Månadskostnad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCompanies.map(comp => (
                                        <tr key={comp.name} onClick={() => setSelectedCompany(comp)} style={{ cursor: 'pointer' }}>
                                            <td><strong>{comp.name}</strong></td>
                                            <td><span className="chain-link">{comp.chain}</span></td>
                                            <td>{comp.city}</td>
                                            <td>{comp.brokerCount}</td>
                                            <td>
                                                <span className={`badge ${comp.isCustomer ? 'badge-active' : 'badge-inactive'}`}>
                                                    {comp.isCustomer ? 'BETALANDE' : 'SAKNAR AVTAL'}
                                                </span>
                                            </td>
                                            <td className="cost-cell">{Math.round(comp.totalCost).toLocaleString()} kr</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'brokers' && (
                    <div className="animate-fade">
                        <div className="board-header">
                            <h2>Mäklare (Slutanvändare)</h2>
                            <button className="primary-btn" onClick={() => setShowCreateModal('broker')}><Plus size={18} /> Ny Mäklare</button>
                        </div>
                        <div className="data-section" style={{ padding: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Namn</th>
                                        <th>Arbetsplats</th>
                                        <th>Status</th>
                                        <th>E-post</th>
                                        <th>Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBrokers.map(broker => (
                                        <tr key={broker.id}>
                                            <td><strong>{broker.firstName} {broker.lastName}</strong></td>
                                            <td>
                                                <div>{broker.brokerage}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{broker.brand}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${broker.isActive ? 'badge-active' : 'badge-inactive'}`}>
                                                    {broker.isActive ? 'LICENSIERAD' : 'INGEN LICENS'}
                                                </span>
                                            </td>
                                            <td>{broker.email}</td>
                                            <td>
                                                <button className="action-btn" onClick={() => setSelectedBroker(broker)}>Visa Profil</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* --- Hierarchical Modals --- */}

            {/* Chain Modal */}
            <Modal isOpen={!!selectedChain} onClose={() => setSelectedChain(null)} title={`Kedja: ${selectedChain?.name}`}>
                {selectedChain && (
                    <div className="modal-hierarchy-view">
                        <div className="stats-row">
                            <div className="mini-stat">
                                <label>Totala Mäklare</label>
                                <div className="val">{selectedChain.brokerCount}</div>
                            </div>
                            <div className="mini-stat">
                                <label>Antal Företag</label>
                                <div className="val">{selectedChain.companyCount}</div>
                            </div>
                            <div className="mini-stat">
                                <label>Kundnummer (Kedja)</label>
                                <div className="val">{selectedChain.customerNumber || '-'}</div>
                            </div>
                        </div>

                        {/* Split view for Cross-selling */}
                        <div className="hierarchy-sub-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3>Anslutna Företag</h3>
                                <div className="upsell-badge">
                                    {Array.from(selectedChain.companies).filter(name => !hierarchy.companies.find(c => c.name === name)?.isCustomer).length} Leads kvar
                                </div>
                            </div>

                            <div className="split-view">
                                <div className="view-column">
                                    <h4 className="column-title"><span className="dot active"></span> Aktiva Konton</h4>
                                    <div className="scroll-list mini">
                                        {Array.from(selectedChain.companies)
                                            .filter(name => hierarchy.companies.find(c => c.name === name)?.isCustomer)
                                            .map(compName => {
                                                const compData = hierarchy.companies.find(c => c.name === compName);
                                                return (
                                                    <div key={compName} className="list-item small" onClick={() => { setSelectedCompany(compData); setSelectedChain(null); }}>
                                                        <div className="info">
                                                            <span className="title">{compName}</span>
                                                            <span className="meta">{compData?.brokerCount} mäklare</span>
                                                        </div>
                                                        <ChevronRight size={14} />
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                <div className="view-column lead-column">
                                    <h4 className="column-title"><span className="dot lead"></span> Merförsäljningspotential</h4>
                                    <div className="scroll-list mini">
                                        {Array.from(selectedChain.companies)
                                            .filter(name => !hierarchy.companies.find(c => c.name === name)?.isCustomer)
                                            .map(compName => {
                                                const compData = hierarchy.companies.find(c => c.name === compName);
                                                const potential = compData?.brokerCount * 149; // Mock potential cost calculation
                                                return (
                                                    <div key={compName} className="list-item small lead-item" onClick={() => { setSelectedCompany(compData); setSelectedChain(null); }}>
                                                        <div className="info">
                                                            <span className="title">{compName}</span>
                                                            <span className="meta">{compData?.brokerCount} mäklare • Est. {potential.toLocaleString()} kr/mån</span>
                                                        </div>
                                                        <button className="mini-action-btn">Bearbeta</button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="notes-section" style={{ marginTop: '2rem' }}>
                            <label>Kedjeanteckningar (Centrala avtal etc.)</label>
                            <textarea
                                placeholder="Anteckningar om centrala ramavtal..."
                                value={comments[`chain_${selectedChain.name}`] || ''}
                                onChange={(e) => saveComment(`chain_${selectedChain.name}`, e.target.value)}
                                style={{
                                    width: '100%', minHeight: '80px', background: 'var(--surface-alt)',
                                    border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text)',
                                    padding: '1rem', outline: 'none', resize: 'none'
                                }}
                            />
                        </div>
                        <div className="modal-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="action-btn danger" onClick={() => deleteChain(selectedChain.name)}>
                                <Trash2 size={16} /> Ta bort hela kedjan
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Company Modal */}
            <Modal isOpen={!!selectedCompany} onClose={() => setSelectedCompany(null)} title={`Företag: ${selectedCompany?.name}`}>
                {selectedCompany && (
                    <div className="modal-hierarchy-view">
                        <div className="parent-context">
                            <label>Tillhör Kedja</label>
                            <div className="context-chip" onClick={() => { setSelectedChain(hierarchy.chains.find(c => c.name === selectedCompany.chain)); setSelectedCompany(null); }}>
                                <Briefcase size={14} /> {selectedCompany.chain}
                            </div>
                        </div>

                        <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
                            <div className="mini-stat">
                                <label>Mäklare</label>
                                <div className="val">{selectedCompany.brokerCount}</div>
                            </div>
                            <div className="mini-stat">
                                <label>Kundnummer (Företag)</label>
                                <div className="val">{selectedCompany.customerNumber || '-'}</div>
                            </div>
                            <div className="mini-stat">
                                <label>Månadsintäkt</label>
                                <div className="val accent">{Math.round(selectedCompany.totalCost).toLocaleString()} kr</div>
                            </div>
                        </div>

                        <div className="hierarchy-sub-section">
                            <h3>Personal på kontoret ({selectedCompany.brokerCount})</h3>
                            <div className="scroll-list">
                                {selectedCompany.brokers.map(b => (
                                    <div key={b.id} className="list-item" onClick={() => { setSelectedBroker(b); setSelectedCompany(null); }}>
                                        <div className={`status-indicator ${b.isActive ? 'active' : 'inactive'}`}></div>
                                        <div className="info">
                                            <span className="title">{b.firstName} {b.lastName}</span>
                                            <span className="meta">{b.email}</span>
                                        </div>
                                        <ChevronRight size={16} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="notes-section">
                            <label>Företagsanteckningar (Säljhistorik)</label>
                            <textarea
                                placeholder="Skriv status för detta företag..."
                                value={comments[`comp_${selectedCompany.name}`] || ''}
                                onChange={(e) => saveComment(`comp_${selectedCompany.name}`, e.target.value)}
                            />
                        </div>
                        <div className="modal-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="action-btn danger" onClick={() => deleteCompany(selectedCompany.name)}>
                                <Trash2 size={16} /> Radera kontoret
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Broker Modal */}
            <Modal isOpen={!!selectedBroker} onClose={() => setSelectedBroker(null)} title="Mäklarprofil">
                {selectedBroker && (
                    <div className="broker-profile">
                        <div className="profile-top">
                            <div className="avatar-big">{selectedBroker.firstName[0]}</div>
                            <div className="name-area">
                                <h2>{selectedBroker.firstName} {selectedBroker.lastName}</h2>
                                <div className="path-tags">
                                    <span onClick={() => { setSelectedChain(hierarchy.chains.find(c => c.name === selectedBroker.brand)); setSelectedBroker(null); }}>{selectedBroker.brand}</span>
                                    <ArrowRight size={12} />
                                    <span onClick={() => { setSelectedCompany(hierarchy.companies.find(c => c.name === selectedBroker.brokerage)); setSelectedBroker(null); }}>{selectedBroker.brokerage}</span>
                                </div>
                            </div>
                        </div>

                        <div className="detail-grid">
                            <div className="detail">
                                <label>Licensstatus</label>
                                <div className={selectedBroker.isActive ? 'text-success' : 'text-error'}>
                                    {selectedBroker.isActive ? 'Aktiv Användare' : 'Lead (Saknar licens)'}
                                </div>
                            </div>
                            <div className="detail">
                                <label>Kundnummer (Ärvt)</label>
                                <div>{selectedBroker.inheritedCustomerNumber || '-'}</div>
                            </div>
                            <div className="detail">
                                <label>Huvudprodukt</label>
                                <div>{selectedBroker.productName || '-'}</div>
                            </div>
                            <div className="detail">
                                <label>E-post</label>
                                <div>{selectedBroker.email}</div>
                            </div>
                            <div className="detail">
                                <label>Månadskostnad</label>
                                <div className="accent">{Math.round(selectedBroker.cost)} kr</div>
                            </div>
                            <div className="detail">
                                <label>Rabatt / mån</label>
                                <div style={{ color: 'var(--warning)' }}>{Math.round(selectedBroker.discount)} kr</div>
                            </div>
                        </div>

                        <div className="notes-section">
                            <label><MessageSquare size={14} /> Personliga Anteckningar</label>
                            <textarea
                                value={comments[selectedBroker.id] || ''}
                                onChange={(e) => saveComment(selectedBroker.id, e.target.value)}
                                placeholder="Dialog med mäklaren..."
                            />
                        </div>

                        <div className="modal-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="action-btn danger" onClick={() => deleteBroker(selectedBroker.id)}>
                                <Trash2 size={16} /> Ta bort mäklare
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* New Prospect Modal */}
            <Modal isOpen={isNewProspectModalOpen} onClose={() => setIsNewProspectModalOpen(false)} title="Lägg till ny bearbetning">
                <div className="prospect-search-container">
                    <p className="text-muted" style={{ marginBottom: '1rem' }}>Sök bland {hierarchy.companies.length} företag på marknaden för att starta en bearbetning.</p>
                    <div className="search-wrapper" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Sök företag att bearbeta..."
                            value={prospectSearch}
                            onChange={(e) => setProspectSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="scroll-list" style={{ maxHeight: '400px' }}>
                        {prospectSearch.length > 1 ? (
                            hierarchy.companies
                                .filter(c => c.name.toLowerCase().includes(prospectSearch.toLowerCase()))
                                .slice(0, 10)
                                .map(comp => (
                                    <div key={comp.name} className="list-item" style={{ justifyContent: 'space-between' }}>
                                        <div className="info">
                                            <span className="title">{comp.name}</span>
                                            <span className="meta">{comp.city} • {comp.brokerCount} mäklare</span>
                                        </div>
                                        <button
                                            className="mini-action-btn"
                                            onClick={() => {
                                                if (!pipeline.prospect.includes(comp.name)) {
                                                    setPipeline({ ...pipeline, prospect: [comp.name, ...pipeline.prospect] });
                                                }
                                                setIsNewProspectModalOpen(false);
                                                setProspectSearch('');
                                            }}
                                        >
                                            Lägg till i tavla
                                        </button>
                                    </div>
                                ))
                        ) : (
                            <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                Skriv minst 2 tecken för att söka...
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Create Entity Modal */}
            <Modal
                isOpen={!!showCreateModal}
                onClose={() => setShowCreateModal(null)}
                title={showCreateModal === 'chain' ? 'Skapa Ny Kedja' : showCreateModal === 'company' ? 'Nytt Företag' : 'Ny Mäklare'}
            >
                <form className="create-form" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData);

                    if (showCreateModal === 'broker') {
                        createBroker({
                            firstName: data.firstName,
                            lastName: data.lastName,
                            email: data.email,
                            brokerage: data.brokerage,
                            brand: data.brand || 'Oberoende',
                            isActive: data.isActive === 'on',
                            cost: parseFloat(data.cost) || 0,
                            discount: 0
                        });
                    } else if (showCreateModal === 'company') {
                        createBroker({
                            firstName: 'Kontor',
                            lastName: 'Profil',
                            email: 'info@' + data.name.toLowerCase().replace(/ /g, '') + '.se',
                            brokerage: data.name,
                            brand: data.brand || 'Oberoende',
                            isActive: false,
                            city: data.city,
                            cost: 0,
                            discount: 0
                        });
                    } else if (showCreateModal === 'chain') {
                        createBroker({
                            firstName: 'Kedja',
                            lastName: 'Profil',
                            email: 'central@' + data.name.toLowerCase().replace(/ /g, '') + '.se',
                            brokerage: 'Huvudkontor',
                            brand: data.name,
                            isActive: false,
                            city: data.city || 'Sverige',
                            cost: 0,
                            discount: 0
                        });
                    }
                    setShowCreateModal(null);
                }}>
                    <div className="form-grid">
                        {showCreateModal === 'broker' && (
                            <>
                                <div className="detail"><label>Förnamn</label><input name="firstName" required /></div>
                                <div className="detail"><label>Efternamn</label><input name="lastName" required /></div>
                                <div className="detail"><label>E-post</label><input name="email" type="email" required /></div>
                                <div className="detail"><label>Företag (Kontor)</label><input name="brokerage" required /></div>
                                <div className="detail"><label>Kedja</label><input name="brand" placeholder="Oberoende" /></div>
                                <div className="detail"><label>Licenskostnad</label><input name="cost" type="number" defaultValue="750" /></div>
                                <div className="detail" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input name="isActive" type="checkbox" style={{ width: 'auto' }} /> <label>Aktiv Licens</label></div>
                            </>
                        )}
                        {showCreateModal === 'company' && (
                            <>
                                <div className="detail"><label>Företagsnamn</label><input name="name" required /></div>
                                <div className="detail"><label>Kedja</label><input name="brand" placeholder="Oberoende" /></div>
                                <div className="detail"><label>Stad</label><input name="city" required /></div>
                            </>
                        )}
                        {showCreateModal === 'chain' && (
                            <>
                                <div className="detail"><label>Kedjans Namn (Brand)</label><input name="name" required /></div>
                                <div className="detail"><label>Huvudkontor Stad</label><input name="city" /></div>
                            </>
                        )}
                    </div>
                    <div className="modal-actions" style={{ marginTop: '2rem' }}>
                        <button type="submit" className="primary-btn" style={{ width: '100%', justifyContent: 'center' }}><Save size={18} /> Spara</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default App;
