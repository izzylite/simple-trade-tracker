# TradeJourno

**AI-Powered Trading Journal** - Track, analyze, and improve your trading performance with intelligent insights.

## 🚀 Overview

TradeJourno is a comprehensive trading journal application designed to help traders track their performance, analyze patterns, and make data-driven decisions. Built with modern web technologies and powered by AI, it provides deep insights into your trading behavior.

## ✨ Key Features

### 📊 **Trade Management**
- **Comprehensive Trade Tracking** - Record entries, exits, stop losses, and take profits
- **Multi-Calendar Support** - Organize trades across multiple trading accounts or strategies
- **Rich Trade Notes** - Document your thought process with a powerful rich text editor
- **Image Attachments** - Attach chart screenshots and analysis to trades
- **Tag System** - Categorize trades with custom tags and required tag groups

### 📈 **Performance Analytics**
- **Interactive Charts** - Visualize performance across multiple dimensions
- **Daily/Weekly/Monthly Statistics** - Track progress over different timeframes
- **Win Rate Analysis** - Detailed breakdown of winning vs losing trades
- **Risk/Reward Metrics** - Analyze risk-to-reward ratios
- **Tag Performance Analysis** - See which strategies perform best
- **Economic Event Correlation** - Understand how market events impact your trades

### 🤖 **AI-Powered Insights**
- **AI Trading Assistant** - Chat with AI about your trading patterns
- **Automated Analysis** - Get insights on your trading behavior
- **Pattern Recognition** - Identify recurring patterns in wins and losses

### 📅 **Economic Calendar Integration**
- **Real-Time Event Tracking** - Stay informed about high-impact economic events
- **Custom Currency Filters** - Track events relevant to your trading pairs
- **Event Notifications** - Get alerted when events are released
- **Trade Correlation** - Link trades to specific economic events

### 🎯 **Advanced Features**
- **Dynamic Risk Management** - Automatically adjust position sizes based on performance
- **Target Setting** - Set and track daily, weekly, monthly, and yearly goals
- **Trade Sharing** - Share trades or entire calendars with others
- **Pinned Trades** - Bookmark important trades for quick reference
- **Gallery Mode** - Review trades visually in a card-based gallery
- **Export/Import** - Backup and restore your trading data

## 🛠️ Technology Stack

### Frontend
- **React 19** with TypeScript
- **Material-UI v7** for modern, responsive UI
- **React Router v7** for navigation
- **Recharts** for data visualization
- **Draft.js** for rich text editing

### Backend
- **Supabase** - PostgreSQL database, authentication, and real-time subscriptions
- **Supabase Edge Functions** - Serverless Deno-based functions for backend logic
- **Supabase Storage** - File storage for trade images

### AI & Data Processing
- **Transformers.js** - Client-side AI embeddings
- **Economic Event Scraper** - Automated data collection from ForexFactory

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Supabase account (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tradejourno.git
   cd tradejourno
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   ```bash
   # Install Supabase CLI
   npm i supabase --save-dev

   # Link to your project
   npx supabase link --project-ref your-project-ref

   # Run migrations
   npx supabase db push
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

   The app will open at [http://localhost:3000](http://localhost:3000)

## 📱 Usage

1. **Create a Calendar** - Set up your first trading calendar with account balance and risk settings
2. **Add Trades** - Click on any day to add a trade with full details
3. **Analyze Performance** - View statistics, charts, and AI insights
4. **Set Goals** - Define targets and track your progress
5. **Review Patterns** - Use tags and filters to identify successful strategies

## 🧪 Development

### Available Scripts

- `npm start` - Run development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run deploy` - Deploy to GitHub Pages

### Database Migrations

```bash
# Create a new migration
npx supabase migration new migration_name

# Apply migrations locally
npx supabase db reset

# Push to production
npx supabase db push
```

### Edge Functions

```bash
# Deploy an edge function
npx supabase functions deploy function-name

# View function logs
npx supabase functions logs function-name
```

## 📦 Project Structure

```
tradejourno/
├── public/              # Static files
├── src/
│   ├── components/      # React components
│   │   ├── charts/      # Chart components
│   │   ├── trades/      # Trade-related components
│   │   ├── common/      # Shared components
│   │   └── aiChat/      # AI assistant components
│   ├── pages/           # Page components
│   ├── services/        # API and business logic
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript type definitions
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
└── CLAUDE.md            # AI coding guidelines
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Economic calendar data sourced from ForexFactory
- UI components powered by Material-UI
- Backend infrastructure by Supabase

## 📧 Support

For support, please open an issue on GitHub.

---

**TradeJourno** - Your trading journey, intelligently tracked.
