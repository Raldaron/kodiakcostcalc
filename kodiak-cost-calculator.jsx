import React, { useState, useMemo } from 'react';

const MiloCostCalculator = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Auth credentials
  const AUTH_USERNAME = 'miloadmin';
  const AUTH_PASSWORD = 'skinacat';

  const handleLogin = () => {
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid username or password');
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl max-w-sm w-full border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-2">Kodiak Cost Calculator</h1>
          <p className="text-slate-400 mb-6">Please sign in to continue</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Volume inputs
  const [weeklyHires, setWeeklyHires] = useState(150);
  const [supportHoursPerMonth, setSupportHoursPerMonth] = useState(6);
  
  // Accelerator toggles
  const [accelerators, setAccelerators] = useState({
    sms: true,
    docCapture: false,
    riskScoring: true,
    i9Command: true,
    batchMode: false,
    slackTeams: true
  });

  // Infrastructure choice
  const [infraTier, setInfraTier] = useState('standard'); // 'minimal', 'standard', 'production'

  const LABOR_RATE = 20; // $/hr

  const calculations = useMemo(() => {
    const monthlyHires = Math.round(weeklyHires * 4.33);
    const annualHires = monthlyHires * 12;

    // =========================================================================
    // CORE PLATFORM COSTS
    // =========================================================================

    // AI Costs (Milo AI)
    // Using Milo Standard for validations: $0.25/1M input, $1.25/1M output
    // ~500 input tokens, ~300 output tokens per validation
    const validationInputTokens = monthlyHires * 500;
    const validationOutputTokens = monthlyHires * 300;
    const validationCost = (validationInputTokens * 0.25 / 1000000) + (validationOutputTokens * 1.25 / 1000000);

    // Exception handling (~10% of hires) using Milo Advanced: $3/1M input, $15/1M output
    // ~1000 input, ~500 output per exception
    const exceptions = Math.round(monthlyHires * 0.10);
    const exceptionInputTokens = exceptions * 1000;
    const exceptionOutputTokens = exceptions * 500;
    const exceptionCost = (exceptionInputTokens * 3 / 1000000) + (exceptionOutputTokens * 15 / 1000000);

    const totalAiCost = validationCost + exceptionCost;

    // Infrastructure Costs
    let infraCosts = { compute: 0, database: 0, monitoring: 0, networking: 0, secrets: 0 };
    
    if (infraTier === 'minimal') {
      // Lambda + DynamoDB (serverless, pay-per-use)
      // Lambda: ~52,000 invocations/month (kicks + syncs + polling)
      // Free tier covers most, estimate $3 overage
      infraCosts.compute = 3;
      // DynamoDB on-demand: ~10,000 writes, ~50,000 reads
      // Writes: $1.25/1M = $0.01, Reads: $0.25/1M = $0.01, Storage: $0.25
      infraCosts.database = 2;
      infraCosts.monitoring = 5; // CloudWatch basic
      infraCosts.networking = 0; // Included
      infraCosts.secrets = 1; // AWS Secrets Manager (4 secrets * $0.40)
    } else if (infraTier === 'standard') {
      // ECS Fargate (2 tasks, 0.25 vCPU, 0.5GB) + RDS
      // Fargate: 2 * 0.25 vCPU * 730 hrs * $0.04048 = $15
      // Fargate memory: 2 * 0.5GB * 730 hrs * $0.004445 = $3
      infraCosts.compute = 18;
      // RDS db.t4g.micro (single-AZ): $12/month
      infraCosts.database = 12;
      infraCosts.monitoring = 10; // CloudWatch + basic alerting
      infraCosts.networking = 5; // NAT Gateway minimal
      infraCosts.secrets = 2;
    } else { // production
      // ECS Fargate (2 tasks, 0.5 vCPU, 1GB, multi-AZ) + RDS Multi-AZ
      infraCosts.compute = 40;
      // RDS db.t4g.small Multi-AZ: $50/month
      infraCosts.database = 50;
      infraCosts.monitoring = 25; // Full monitoring stack
      infraCosts.networking = 15; // NAT Gateway
      infraCosts.secrets = 3;
    }

    const totalInfraCost = Object.values(infraCosts).reduce((a, b) => a + b, 0);

    // Support Labor
    const supportLaborCost = supportHoursPerMonth * LABOR_RATE;

    // Core Platform Total
    const corePlatformCost = totalAiCost + totalInfraCost + supportLaborCost;

    // =========================================================================
    // ACCELERATOR COSTS
    // =========================================================================

    let acceleratorCosts = {};

    // SMS Concierge - using Telnyx (lowest cost)
    // Outbound: $0.004/segment, Inbound: $0.003/segment
    if (accelerators.sms) {
      const outboundMessages = monthlyHires * 8; // avg 8 outbound per candidate
      const inboundMessages = monthlyHires * 4;  // avg 4 inbound responses
      const smsOutboundCost = outboundMessages * 0.004;
      const smsInboundCost = inboundMessages * 0.003;
      const phoneNumberCost = 1; // $1/month per number
      // AI for conversations - Milo Standard, ~800 tokens per conversation
      const conversationAiCost = monthlyHires * 0.8 * ((500 * 0.25 / 1000000) + (300 * 1.25 / 1000000));
      acceleratorCosts.sms = {
        name: 'SMS Concierge',
        breakdown: {
          'Outbound SMS (Telnyx)': smsOutboundCost,
          'Inbound SMS (Telnyx)': smsInboundCost,
          'Phone Number': phoneNumberCost,
          'AI Conversations (Milo Standard)': conversationAiCost
        },
        total: smsOutboundCost + smsInboundCost + phoneNumberCost + conversationAiCost
      };
    }

    // Smart Document Capture
    if (accelerators.docCapture) {
      const docsPerCandidate = 2.5; // avg docs uploaded
      const totalDocs = monthlyHires * docsPerCandidate;
      // Google Cloud Vision: $1.50/1000 images (cheaper than Textract for this use case)
      const ocrCost = (totalDocs / 1000) * 1.50;
      // AI validation - Milo Standard, ~1000 tokens per doc
      const docAiCost = totalDocs * ((700 * 0.25 / 1000000) + (300 * 1.25 / 1000000));
      // S3 storage: ~500KB per doc, minimal
      const storageCost = (totalDocs * 0.5 / 1000) * 0.023; // $0.023/GB

      acceleratorCosts.docCapture = {
        name: 'Smart Document Capture',
        breakdown: {
          'OCR (Google Vision)': ocrCost,
          'AI Validation (Milo Standard)': docAiCost,
          'Storage (S3)': storageCost
        },
        total: ocrCost + docAiCost + storageCost
      };
    }

    // Predictive Risk Scoring
    if (accelerators.riskScoring) {
      // Run inference on Lambda with simple sklearn model - essentially free compute
      // Feature extraction from DB: minimal
      // Model retraining monthly: 1 hr SageMaker ml.m5.large = $0.115/hr
      const inferenceCost = 0.50; // Lambda compute negligible, round up
      const retrainingCost = 5; // Monthly batch retrain
      acceleratorCosts.riskScoring = {
        name: 'Predictive Risk Scoring',
        breakdown: {
          'Inference Compute': inferenceCost,
          'Monthly Model Retrain': retrainingCost
        },
        total: inferenceCost + retrainingCost
      };
    }

    // I-9 Deadline Command Center
    if (accelerators.i9Command) {
      // Additional cron jobs + alerting
      // EventBridge: free tier covers
      // SNS notifications: ~$0.50/1000 emails
      const alertEmails = monthlyHires * 2; // avg 2 deadline alerts per candidate
      const alertCost = (alertEmails / 1000) * 0.50;
      // Additional compute for deadline tracking: minimal
      acceleratorCosts.i9Command = {
        name: 'I-9 Deadline Command Center',
        breakdown: {
          'Alert Notifications (SNS)': alertCost,
          'Compute Overhead': 2
        },
        total: alertCost + 2
      };
    }

    // Batch Onboarding Mode
    if (accelerators.batchMode) {
      // No real additional cost - just feature code
      // Slight increase in concurrent Lambda executions
      acceleratorCosts.batchMode = {
        name: 'Batch Onboarding Mode',
        breakdown: {
          'Additional Compute': 1
        },
        total: 1
      };
    }

    // Slack/Teams Integration
    if (accelerators.slackTeams) {
      // Slack/Teams APIs are free
      // AI for natural language queries - Milo Standard
      const queries = monthlyHires * 0.5; // avg 0.5 queries per candidate lifecycle
      const queryAiCost = queries * ((400 * 0.25 / 1000000) + (200 * 1.25 / 1000000));
      acceleratorCosts.slackTeams = {
        name: 'Slack & Teams Integration',
        breakdown: {
          'AI Queries (Milo Standard)': queryAiCost,
          'Webhook Hosting': 1
        },
        total: queryAiCost + 1
      };
    }

    const totalAcceleratorCost = Object.values(acceleratorCosts).reduce((acc, a) => acc + a.total, 0);

    // =========================================================================
    // TOTALS
    // =========================================================================

    const totalMonthlyCost = corePlatformCost + totalAcceleratorCost;
    const totalAnnualCost = totalMonthlyCost * 12;
    const costPerHire = totalMonthlyCost / monthlyHires;

    return {
      monthlyHires,
      annualHires,
      
      // AI breakdown
      validationCost,
      exceptionCost,
      exceptions,
      totalAiCost,
      
      // Infrastructure breakdown
      infraCosts,
      totalInfraCost,
      
      // Labor
      supportLaborCost,
      
      // Core total
      corePlatformCost,
      
      // Accelerators
      acceleratorCosts,
      totalAcceleratorCost,
      
      // Grand totals
      totalMonthlyCost,
      totalAnnualCost,
      costPerHire
    };
  }, [weeklyHires, supportHoursPerMonth, accelerators, infraTier]);

  const formatCurrency = (value, decimals = 2) => {
    if (value < 0.01 && value > 0) return '<$0.01';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">MiloStudio.ai</h1>
          <p className="text-lg text-slate-400">Operating Cost Calculator</p>
          <p className="text-sm text-slate-500 mt-1">Detailed cost breakdown with lowest-cost providers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            {/* Volume */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Volume</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Weekly Hires</label>
                  <input
                    type="number"
                    value={weeklyHires}
                    onChange={(e) => setWeeklyHires(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    = {calculations.monthlyHires}/mo • {calculations.annualHires.toLocaleString()}/yr
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Support Hours/Month</label>
                  <input
                    type="number"
                    value={supportHoursPerMonth}
                    onChange={(e) => setSupportHoursPerMonth(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">@ ${LABOR_RATE}/hr = {formatCurrency(calculations.supportLaborCost)}</p>
                </div>
              </div>
            </div>

            {/* Infrastructure Tier */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Infrastructure</h2>
              <div className="space-y-2">
                {[
                  { key: 'minimal', name: 'Minimal', desc: 'Lambda + DynamoDB' },
                  { key: 'standard', name: 'Standard', desc: 'Fargate + RDS' },
                  { key: 'production', name: 'Production', desc: 'Multi-AZ, HA' }
                ].map(tier => (
                  <button
                    key={tier.key}
                    onClick={() => setInfraTier(tier.key)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      infraTier === tier.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-medium">{tier.name}</div>
                    <div className="text-xs opacity-75">{tier.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accelerators */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Accelerators</h2>
              <div className="space-y-2">
                {[
                  { key: 'sms', name: 'SMS Concierge' },
                  { key: 'docCapture', name: 'Document Capture' },
                  { key: 'riskScoring', name: 'Risk Scoring' },
                  { key: 'i9Command', name: 'I-9 Command Center' },
                  { key: 'batchMode', name: 'Batch Mode' },
                  { key: 'slackTeams', name: 'Slack/Teams' }
                ].map(acc => (
                  <label
                    key={acc.key}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                      accelerators[acc.key]
                        ? 'bg-green-900/50 border border-green-700'
                        : 'bg-slate-700 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={accelerators[acc.key]}
                      onChange={(e) => setAccelerators({ ...accelerators, [acc.key]: e.target.checked })}
                      className="mr-3"
                    />
                    <span className="text-sm">{acc.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Middle + Right - Cost Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5">
                <div className="text-blue-200 text-sm">Monthly Cost</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(calculations.totalMonthlyCost)}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5">
                <div className="text-purple-200 text-sm">Annual Cost</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(calculations.totalAnnualCost, 0)}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5">
                <div className="text-emerald-200 text-sm">Cost per Hire</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(calculations.costPerHire)}</div>
              </div>
            </div>

            {/* Core Platform Breakdown */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Core Platform Costs
              </h2>
              
              {/* AI Costs */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300 font-medium">AI (Milo AI)</span>
                  <span className="text-white font-semibold">{formatCurrency(calculations.totalAiCost)}</span>
                </div>
                <div className="ml-4 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Validations (Milo Standard) × {calculations.monthlyHires}</span>
                    <span>{formatCurrency(calculations.validationCost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Exception Handling (Milo Advanced) × {calculations.exceptions}</span>
                    <span>{formatCurrency(calculations.exceptionCost)}</span>
                  </div>
                </div>
              </div>

              {/* Infrastructure Costs */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300 font-medium">Infrastructure ({infraTier})</span>
                  <span className="text-white font-semibold">{formatCurrency(calculations.totalInfraCost)}</span>
                </div>
                <div className="ml-4 space-y-1 text-sm">
                  {Object.entries(calculations.infraCosts).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-slate-400">
                      <span className="capitalize">{key}</span>
                      <span>{formatCurrency(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labor */}
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Support Labor ({supportHoursPerMonth} hrs × ${LABOR_RATE})</span>
                  <span className="text-white font-semibold">{formatCurrency(calculations.supportLaborCost)}</span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-slate-200 font-semibold">Core Platform Total</span>
                <span className="text-white font-bold">{formatCurrency(calculations.corePlatformCost)}</span>
              </div>
            </div>

            {/* Accelerator Breakdown */}
            {Object.keys(calculations.acceleratorCosts).length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Accelerator Costs
                </h2>
                
                {Object.entries(calculations.acceleratorCosts).map(([key, acc]) => (
                  <div key={key} className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300 font-medium">{acc.name}</span>
                      <span className="text-white font-semibold">{formatCurrency(acc.total)}</span>
                    </div>
                    <div className="ml-4 space-y-1 text-sm">
                      {Object.entries(acc.breakdown).map(([item, cost]) => (
                        <div key={item} className="flex justify-between text-slate-400">
                          <span>{item}</span>
                          <span>{formatCurrency(cost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="border-t border-slate-700 pt-3 flex justify-between">
                  <span className="text-slate-200 font-semibold">Accelerators Total</span>
                  <span className="text-white font-bold">{formatCurrency(calculations.totalAcceleratorCost)}</span>
                </div>
              </div>
            )}

            {/* Provider Reference */}
            <div className="bg-slate-800/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Provider Reference (Lowest Cost)
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">AI - Validation</div>
                  <div className="text-slate-300">Milo AI Standard ($0.25/$1.25 per 1M tokens)</div>
                </div>
                <div>
                  <div className="text-slate-500">AI - Exceptions</div>
                  <div className="text-slate-300">Milo AI Advanced ($3/$15 per 1M tokens)</div>
                </div>
                <div>
                  <div className="text-slate-500">SMS Provider</div>
                  <div className="text-slate-300">Telnyx ($0.004 out / $0.003 in)</div>
                </div>
                <div>
                  <div className="text-slate-500">OCR</div>
                  <div className="text-slate-300">Google Cloud Vision ($1.50/1K images)</div>
                </div>
                <div>
                  <div className="text-slate-500">Compute</div>
                  <div className="text-slate-300">AWS Lambda / Fargate</div>
                </div>
                <div>
                  <div className="text-slate-500">Database</div>
                  <div className="text-slate-300">DynamoDB / RDS PostgreSQL</div>
                </div>
                <div>
                  <div className="text-slate-500">ML Inference</div>
                  <div className="text-slate-300">Lambda + sklearn (near-free)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>MiloStudio.ai Operating Cost Calculator • Internal Use Only</p>
          <p className="text-xs mt-1">Costs based on AWS us-east-1 pricing as of Jan 2025</p>
        </div>
      </div>
    </div>
  );
};

export default MiloCostCalculator;
