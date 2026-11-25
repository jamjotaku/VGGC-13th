// src/eventConfig.js
// VGGC イベント固有設定の一元管理ファイル
// 次回イベント以降は本ファイルと public/ 配下のデータ差し替えだけで対応可能

export const EVENT_CONFIG = {
  // 基本情報
  name: 'VGGC 13th',
  shortName: 'VGGC 13th',
  slug: 'vggc13th',
  dummyEmailDomain: 'vggc-13th.vercel.app',
  adminContactX: '@VGGC_APP_INFO', // アプリ管理用 X アカウント
  hashtag: '#VGGC13th',
  siteUrl: 'https://vggc-13th.vercel.app/',
  title: 'VGGC 13th サークルリスト & 会場マップ',
  ogTitle: 'VGGC 13th サークルリスト＆買い物支援ツール',
  ogDescription:
    '当日の買い回りをスマホでサクサク快適に！会場マップ発光ピン・完全オフライン対応・公式タイテ同期＆TRC周辺ATMガイド搭載。ログイン不要ですぐに使えます。',
  manifestDescription:
    'ぶいすぽっ！オンリー即売会「VGGC 13th」のサークル配置マップ、お品書き・商品管理、買い物リスト作成ツール（完全オフライン対応）',

  // 日時・会場
  date: '2027-03-06',
  dateLabel: '3/6(土)',
  dateShort: '3/6',
  dateCode: '0306', // レシート番号等に使用 (VGGC-0306-xxxx)
  venue: 'TRC第一展示場 (A-Dホール)',
  venueFull: '東京流通センター (TRC) 第一展示場',
  startTime: '12:00',
  endTime: '15:30',
  start: '2027-03-06T12:00:00+09:00',
  end: '2027-03-06T15:30:00+09:00',
  dayStart: '2027-03-06T00:00:00+09:00',
  dayEnd: '2027-03-07T00:00:00+09:00',

  // 公式タイムテーブル（前回踏襲案：確定後にここを更新すれば全画面・通知に即時反映）
  timetable: [
    {
      key: '9:45',
      time: '09:45',
      endTime: '',
      displayTime: '09:45-',
      label: '一般参加者受付開始',
      title: '一般参加者受付開始',
      memo: '',
      highlight: 'normal', // 'normal' | 'open' | 'close'
      activeFromMinutes: 9 * 60 + 45,
      activeUntilMinutes: 10 * 60
    },
    {
      key: '10:00',
      time: '10:00',
      endTime: '11:40',
      displayTime: '10:00-',
      label: 'サークル入場 (11:40迄) / 更衣室開場',
      title: 'サークル入場 (11:40迄) / 更衣室開場',
      memo: 'サークル入場締切: 11:40 / 更衣室開場',
      highlight: 'normal',
      activeFromMinutes: 10 * 60,
      activeUntilMinutes: 12 * 60
    },
    {
      key: '12:00',
      time: '12:00',
      endTime: '',
      displayTime: '12:00',
      label: '即売会開会（一般入場開始）',
      title: '即売会開会（一般入場開始）',
      memo: '即売会開会',
      highlight: 'open',
      activeFromMinutes: 12 * 60,
      activeUntilMinutes: 15 * 60 + 30
    },
    {
      key: '15:30',
      time: '15:30',
      endTime: '',
      displayTime: '15:30',
      label: '即売会終了',
      title: '即売会終了',
      memo: '一般頒布終了',
      highlight: 'close',
      activeFromMinutes: 15 * 60 + 30,
      activeUntilMinutes: 15 * 60 + 45
    },
    {
      key: '15:45',
      time: '15:45',
      endTime: '17:00',
      displayTime: '15:45-',
      label: 'アフターイベント (17:00完全撤収)',
      title: 'アフターイベント (17:00完全撤収)',
      memo: '17:00完全撤収',
      highlight: 'normal',
      activeFromMinutes: 15 * 60 + 45,
      activeUntilMinutes: 17 * 60
    }
  ],

  // ストレージキー生成ヘルパー
  storageKey(suffix) {
    return `${this.slug}_${suffix}`;
  },

  // 簡易POSレジ設定（v2汎用化済み: 12th互換の固定デフォルトは無効化）
  register: {
    defaultCircleId: '',
    defaultCircleName: '',
    defaultCircleSpace: '',
    unlockedEmailPrefixes: []
  },

  // サークル認証・フェーズ設計設定（T-074 Step A: 後から切替容易な集約定義）
  circleAuth: {
    inviteExpiresAtIso: '2027-03-08T00:00:00+09:00',
    inviteExpireLabel: 'イベント終了翌日（2027-03-07末）まで有効',
    enableP0PrepToolsPublic: true,
    enableStaffRevokeByOwner: true,
    enableConflictClaimBlock: true
  },

  // デフォルト初期アナウンス (Supabase未接続時やオフライン時の安全フォールバック)
  defaultNotifications: [
    {
      id: 'default_welcome_vggc13th',
      created_at: '2026-11-16T12:00:00Z',
      title: 'VGGC 13th お買い物支援ツール 準備中！',
      body: '2027年3月6日(土) 東京流通センター第一展示場での開催に向けて、事前準備・お買い物支援機能のアップデートを進めています！',
      type: 'feature',
      category: 'announcement',
      is_pinned: true,
      link_url: null
    },
    {
      id: 'default_official_schedule',
      created_at: '2026-11-16T11:00:00Z',
      title: '【予定】3/6(土) 当日スケジュール案内（前回踏襲案）',
      body: '09:45 受付開始\n10:00 サークル入場/更衣室開場\n12:00 即売会開会（一般入場）\n15:30 即売会終了\n15:45 アフターイベント',
      type: 'official',
      category: 'official',
      is_pinned: false,
      link_url: null
    }
  ]
};
