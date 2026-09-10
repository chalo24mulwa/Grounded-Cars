// Static, hand-written testimonials for the /reviews page — there's no
// review-submission feature (customers don't post these themselves), so
// this is plain content data, not something backed by the database. Kept
// in its own module (rather than inline in the page) so both the /reviews
// page and the site-wide ReviewsCta banner (see
// src/components/layout/ReviewsCta.tsx) can share the same list and the
// same derived average rating without them drifting apart.
export type Testimonial = {
  id: string;
  name: string;
  location?: string;
  /** 1-5. */
  rating: number;
  quote: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "wanjiru-kamau",
    name: "Wanjiru Kamau",
    location: "Nairobi",
    rating: 5,
    quote:
      "I sold my Toyota Axio within a week of listing it on Car Marketplace. The process was so simple and I got serious buyers almost immediately.",
  },
  {
    id: "otieno-odhiambo",
    name: "Otieno Odhiambo",
    location: "Kisumu",
    rating: 5,
    quote:
      "Buying my Subaru Forester here was stress-free. The listing was verified and exactly as described — no surprises when I went to view it.",
  },
  {
    id: "amina-hassan",
    name: "Amina Hassan",
    location: "Mombasa",
    rating: 4,
    quote:
      "Good experience overall. It took a little longer to find the right fresh import, but the team on WhatsApp kept me updated throughout.",
  },
  {
    id: "kevin-mwangi",
    name: "Kevin Mwangi",
    location: "Nakuru",
    rating: 5,
    quote:
      "As a small dealer, listing my cars for free has made a huge difference. I've closed three sales through the platform this month alone.",
  },
  {
    id: "faith-chebet",
    name: "Faith Chebet",
    location: "Eldoret",
    rating: 5,
    quote:
      "I used the Car Valuation service before selling my Mazda Demio and it gave me the confidence to negotiate a fair price.",
  },
  {
    id: "brian-kiptoo",
    name: "Brian Kiptoo",
    location: "Nairobi",
    rating: 5,
    quote:
      "The Sponsor My Listing feature really works — my pickup got way more views once I boosted it, and it sold within days.",
  },
  {
    id: "grace-nyambura",
    name: "Grace Nyambura",
    location: "Thika",
    rating: 5,
    quote:
      "I was nervous about buying online, but the verified badge and easy communication with the seller put my mind at ease.",
  },
  {
    id: "samuel-kimani",
    name: "Samuel Kimani",
    location: "Nairobi",
    rating: 4,
    quote:
      "Great platform for finding locally used cars. I wish there were a few more filter options, but customer support was very helpful.",
  },
  {
    id: "mercy-adhiambo",
    name: "Mercy Adhiambo",
    location: "Kisumu",
    rating: 5,
    quote:
      "I appreciated how quickly I could reach sellers on WhatsApp straight from the listing. Bought my Nissan March within two weeks.",
  },
  {
    id: "david-njoroge",
    name: "David Njoroge",
    location: "Nyeri",
    rating: 5,
    quote:
      "Car Marketplace helped me find a genuine fresh-import Toyota Premio at a fair price. The whole process felt transparent.",
  },
  {
    id: "sharon-wambui",
    name: "Sharon Wambui",
    location: "Nairobi",
    rating: 5,
    quote:
      "I love that a portion of the platform's revenue goes to CSR initiatives. It feels good supporting a business that gives back.",
  },
  {
    id: "peter-mutiso",
    name: "Peter Mutiso",
    location: "Machakos",
    rating: 4,
    quote:
      "Selling my old pickup was easier than I expected. It took a few weeks, but I finally got a buyer at a price I was happy with.",
  },
  {
    id: "lucy-wairimu",
    name: "Lucy Wairimu",
    location: "Nairobi",
    rating: 5,
    quote:
      "The car tracking installation service gave me real peace of mind after buying my car. Booking it through the site was seamless.",
  },
  {
    id: "james-omondi",
    name: "James Omondi",
    location: "Kisumu",
    rating: 5,
    quote:
      "I've bought two vehicles through Car Marketplace for my taxi business. Both times the listings were accurate and the sellers genuine.",
  },
  {
    id: "ann-wangari",
    name: "Ann Wangari",
    location: "Nakuru",
    rating: 5,
    quote:
      "Getting my car insured through the platform's insurance partners saved me so much time. Everything was sorted in one afternoon.",
  },
  {
    id: "joseph-kariuki",
    name: "Joseph Kariuki",
    location: "Nairobi",
    rating: 4,
    quote:
      "Solid marketplace with a clean, easy-to-use website. Would love to see even more listings in the SUV category.",
  },
  {
    id: "esther-chepkoech",
    name: "Esther Chepkoech",
    location: "Eldoret",
    rating: 5,
    quote:
      "I sold my Toyota Vitz to a buyer from Nairobi without ever leaving Eldoret. Communication was smooth from start to finish.",
  },
  {
    id: "daniel-mwakio",
    name: "Daniel Mwakio",
    location: "Mombasa",
    rating: 5,
    quote:
      "The pre-purchase inspection service caught an issue I would have completely missed. It saved me from a costly mistake before buying.",
  },
  {
    id: "caroline-achieng",
    name: "Caroline Achieng",
    location: "Kisumu",
    rating: 5,
    quote:
      "As a first-time car buyer, I felt supported throughout. The team explained the process clearly and answered every question I had.",
  },
  {
    id: "moses-kiprono",
    name: "Moses Kiprono",
    location: "Nakuru",
    rating: 5,
    quote:
      "Listing my Isuzu truck was completely free and I reached buyers I never would have found on my own.",
  },
  {
    id: "beatrice-nduta",
    name: "Beatrice Nduta",
    location: "Thika",
    rating: 4,
    quote:
      "Good service and a trustworthy platform. It would help to have a few more payment options for boosting listings.",
  },
  {
    id: "collins-otieno",
    name: "Collins Otieno",
    location: "Nairobi",
    rating: 5,
    quote:
      "I financed my first car through a partner linked from Car Marketplace. The whole experience felt professional and secure.",
  },
  {
    id: "rose-wanjiku",
    name: "Rose Wanjiku",
    location: "Nairobi",
    rating: 5,
    quote:
      "Found my dream car, a Toyota Harrier, within days of searching. The photos and details matched perfectly with the actual car.",
  },
  {
    id: "anthony-muriuki",
    name: "Anthony Muriuki",
    location: "Meru",
    rating: 5,
    quote:
      "Selling to buyers across the whole country instead of just my local area made all the difference. I got a much better price than I expected.",
  },
];

// Shared by the /reviews page (headline stat + JSON-LD) and ReviewsCta
// (the site-wide banner above the footer) so both always agree.
export const AVERAGE_RATING =
  TESTIMONIALS.reduce((sum, t) => sum + t.rating, 0) / TESTIMONIALS.length;
