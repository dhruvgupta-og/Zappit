const fs = require('fs');

const generateId = () => [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

const storeId = "6a367d4b3a6db6e97aeb5601";
const defaultImage = "https://i.postimg.cc/1tln57Y0/Chat-GPT-Image-Jun-20-2026-06-04-03-PM.png";

const items = [
  { name: "Cheese Maggi", price: 60, category: "Snacks", isVeg: true },
  { name: "White Sauce Pasta", price: 90, category: "Snacks", isVeg: true },
  { name: "Red Sauce Pasta", price: 90, category: "Snacks", isVeg: true },
  { name: "Coffee", price: 20, category: "Beverages", isVeg: true },
  { name: "Chai", price: 20, category: "Beverages", isVeg: true },
  { name: "Sandwich", price: 50, category: "Snacks", isVeg: true },
  { name: "Cheese Sandwich", price: 60, category: "Snacks", isVeg: true }
];

const jsonArray = items.map(item => ({
  _id: generateId(),
  __v: 0,
  category: item.category,
  desc: "",
  image: defaultImage,
  isVeg: item.isVeg,
  is_available: true,
  name: item.name,
  price: item.price,
  store_id: storeId
}));

fs.writeFileSync('C:\\zappit\\menu_import.json', JSON.stringify(jsonArray, null, 2));
console.log("File created at C:\\zappit\\menu_import.json");
