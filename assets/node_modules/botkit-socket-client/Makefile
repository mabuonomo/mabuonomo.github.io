command := docker-compose run -u 1000 --rm node

build-prod:
	make format
	${command} npm run build

watch-dev:
	${command} npm run watch

install:
	${command} npm install

format:
	${command} npm run format
	${command} npm run tslint:fix

test:
	${command} npm run test