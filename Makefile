.PHONY: start

start:
	docker-compose up

stop:
	docker-compose stop

down:
	docker-compose down

prod:
	docker-compose run node ng build --prod --base-href 'https://mabuonomo.github.io/'