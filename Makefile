.PHONY: start

start:
	docker-compose up

stop:
	docker-compose stop

down:
	docker-compose down

update:
	rm Gemfile.lock
	docker-compose run site bundle update