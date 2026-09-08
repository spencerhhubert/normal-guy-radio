package main

import (
	"hash/fnv"

	"github.com/spencerhhubert/normal-guy-radio/server/api"
)

// A person's name is a function of the id their browser keeps, so it comes back tomorrow with nothing stored here.
var adjectives = []string{"Listening", "Singing", "Humming", "Whistling", "Dancing", "Tapping", "Swaying", "Grooving", "Nodding", "Snoozing", "Vibing", "Bopping", "Jamming", "Strumming", "Drumming", "Tuning", "Cruising", "Chilling", "Waltzing", "Bouncing", "Shuffling", "Wiggling", "Skipping", "Twirling", "Clapping", "Snapping", "Yodeling", "Crooning", "Serenading", "Jiving", "Boogieing", "Moonwalking", "Lounging", "Dozing", "Daydreaming", "Doodling", "Snacking", "Sipping", "Idling", "Wandering", "Drifting", "Loafing", "Grinning", "Giggling", "Marching", "Prancing", "Strutting", "Sneaking", "Tiptoeing", "Hovering", "Loitering", "Whooping", "Toe-tapping", "Head-bobbing", "Air-drumming", "Slow-dancing"}

var animals = []struct{ name, emoji string }{{"Shark", "🦈"}, {"Otter", "🦦"}, {"Sloth", "🦥"}, {"Llama", "🦙"}, {"Flamingo", "🦩"}, {"Penguin", "🐧"}, {"Koala", "🐨"}, {"Panda", "🐼"}, {"Fox", "🦊"}, {"Owl", "🦉"}, {"Frog", "🐸"}, {"Octopus", "🐙"}, {"Whale", "🐳"}, {"Dolphin", "🐬"}, {"Turtle", "🐢"}, {"Snail", "🐌"}, {"Bee", "🐝"}, {"Butterfly", "🦋"}, {"Hedgehog", "🦔"}, {"Raccoon", "🦝"}, {"Badger", "🦡"}, {"Beaver", "🦫"}, {"Bison", "🦬"}, {"Moose", "🫎"}, {"Goose", "🪿"}, {"Duck", "🦆"}, {"Swan", "🦢"}, {"Parrot", "🦜"}, {"Peacock", "🦚"}, {"Dodo", "🦤"}, {"Seal", "🦭"}, {"Crab", "🦀"}, {"Lobster", "🦞"}, {"Shrimp", "🦐"}, {"Squid", "🦑"}, {"Kangaroo", "🦘"}, {"Camel", "🐫"}, {"Giraffe", "🦒"}, {"Zebra", "🦓"}, {"Hippo", "🦛"}, {"Rhino", "🦏"}, {"Elephant", "🐘"}, {"Gorilla", "🦍"}, {"Orangutan", "🦧"}, {"Monkey", "🐒"}, {"Lion", "🦁"}, {"Tiger", "🐯"}, {"Leopard", "🐆"}, {"Wolf", "🐺"}, {"Bear", "🐻"}, {"Cat", "🐱"}, {"Dog", "🐶"}, {"Poodle", "🐩"}, {"Pig", "🐷"}, {"Cow", "🐮"}, {"Goat", "🐐"}, {"Sheep", "🐑"}, {"Horse", "🐴"}, {"Unicorn", "🦄"}, {"Chicken", "🐔"}, {"Rooster", "🐓"}, {"Turkey", "🦃"}, {"Hamster", "🐹"}, {"Rabbit", "🐰"}, {"Mouse", "🐭"}, {"Chipmunk", "🐿️"}, {"Bat", "🦇"}, {"Dragon", "🐲"}, {"T-Rex", "🦖"}, {"Dinosaur", "🦕"}, {"Lizard", "🦎"}, {"Snake", "🐍"}, {"Crocodile", "🐊"}, {"Eagle", "🦅"}, {"Dove", "🕊️"}, {"Ant", "🐜"}, {"Cricket", "🦗"}, {"Ladybug", "🐞"}, {"Jellyfish", "🪼"}, {"Skunk", "🦨"}, {"Blowfish", "🐡"}, {"Tropical Fish", "🐠"}, {"Boar", "🐗"}, {"Ox", "🐂"}, {"Ram", "🐏"}, {"Deer", "🦌"}, {"Mammoth", "🦣"}, {"Caterpillar", "🐛"}, {"Beetle", "🪲"}}

func Name(person string) api.Person {
	h := fnv.New64a()
	h.Write([]byte(person))
	x := h.Sum64()
	a := adjectives[x%uint64(len(adjectives))]
	b := animals[(x/uint64(len(adjectives)))%uint64(len(animals))]
	return api.Person{Name: a + " " + b.name, Emoji: b.emoji}
}
