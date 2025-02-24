# Understanding the Search Term Classification Script 🔍

Hey there! Let's talk about this cool script that helps us understand what people are searching for on Google. Imagine you're a detective trying to figure out why people are looking for things on the internet - that's exactly what this script does!

## What Does It Do? 🤔

This script is like a smart helper that reads search words from a Google Sheet and tries to put them into different groups (or "categories"). It's like sorting your toys into different boxes - some are for playing, some are for learning, and some are for collecting!

### The Categories We Use 📦

1. **INFORMATIONAL** - When someone wants to learn something (like "how do dolphins sleep?")
2. **NAVIGATIONAL** - When someone is looking for a specific website (like "YouTube homepage")
3. **COMMERCIAL** - When someone wants to buy something but is still looking around (like "best running shoes")
4. **TRANSACTIONAL** - When someone is ready to buy right now! (like "buy Nike Air Max size 7")
5. **LOCAL** - When someone is looking for something nearby (like "pizza places near me")
6. **QUESTION** - When someone asks a direct question (like "what time is it in Tokyo?")

## How Does It Work? 🛠️

1. First, it opens a special Google Sheet where we keep our search words
2. Then, it uses a super smart AI (called OpenAI) to look at each search word
3. The AI thinks really hard about which category the search belongs to
4. Finally, it writes all its findings back to the sheet in a neat way

## Cool Features 🌟

- It's really careful and will try up to 3 times if something goes wrong
- It can use a "cheaper" version of AI if we want to save money
- It keeps track of how long it takes to figure out each search word
- If something goes wrong, it writes down what happened in a special "Logs" sheet

## Why Is This Useful? 💡

Understanding how people search helps businesses:
- Make better websites
- Write better ads
- Help customers find what they're looking for more easily
- Save money on advertising

It's like having a super-smart assistant that helps you understand what your customers want before they even become customers!

## Example 🎯

If someone searches for "how to make chocolate chip cookies":
- The script would probably put this in the **INFORMATIONAL** category
- It would be very confident about this choice (maybe 0.9 confidence)
- It would take just a few seconds to figure this out
- The result would show up nicely in the "Results" sheet

Remember: This script is like a helpful robot that does in minutes what would take a person hours or days to do by hand! 🤖 