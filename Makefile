BUCKET  = cv90.leinonen.ninja
DIST_ID = EA7YGQUKPW1X

.PHONY: start deploy

start:
	python3 -m http.server 8000

deploy:
	aws s3 sync . s3://$(BUCKET) --delete --exclude '*' --include 'index.html' --include 'favicon.png' --include 'src/*'
	aws cloudfront create-invalidation --distribution-id $(DIST_ID) --paths '/*' --query 'Invalidation.Id' --output text
