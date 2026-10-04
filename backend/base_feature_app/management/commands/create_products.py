import os
import io
import random
from faker import Faker
from django.core.files import File
from django.core.files.base import ContentFile
from base_feature_app.models import Product
from django.core.management.base import BaseCommand
from django_attachments.models import Attachment, Library
from PIL import Image, ImageDraw

GRADIENT_PALETTES = [
    ((255, 107, 107), (255, 142, 83)),
    ((108, 99, 255), (168, 130, 255)),
    ((0, 184, 148), (85, 239, 196)),
    ((253, 203, 110), (255, 159, 67)),
    ((9, 132, 227), (116, 185, 255)),
    ((232, 67, 147), (255, 118, 117)),
    ((0, 206, 209), (72, 219, 251)),
    ((255, 71, 87), (255, 107, 129)),
    ((46, 213, 115), (123, 237, 159)),
    ((255, 165, 2), (255, 200, 87)),
]

class Command(BaseCommand):
    help = 'Create Product records in the database'

    def add_arguments(self, parser):
        parser.add_argument('number_of_products', type=int, nargs='?', default=10)

    def handle(self, *args, **options):
        number_of_products = options['number_of_products']
        fake = Faker()

        # List of test images
        test_images = [
            'media/temp/product/image_temp1.webp',
            'media/temp/product/image_temp2.webp',
            'media/temp/product/image_temp3.webp',
            'media/temp/product/image_temp4.webp',
        ]

        def _generate_gradient_image(index):
            """Generate a colorful gradient placeholder image."""
            w, h = 800, 600
            c1, c2 = GRADIENT_PALETTES[index % len(GRADIENT_PALETTES)]
            img = Image.new('RGB', (w, h))
            for y in range(h):
                t = y / h
                r = int(c1[0] + (c2[0] - c1[0]) * t)
                g = int(c1[1] + (c2[1] - c1[1]) * t)
                b = int(c1[2] + (c2[2] - c1[2]) * t)
                row = Image.new('RGB', (w, 1), (r, g, b))
                img.paste(row, (0, y))
            draw = ImageDraw.Draw(img, 'RGBA')
            for _ in range(4):
                cx, cy = random.randint(0, w), random.randint(0, h)
                cr = random.randint(80, 200)
                draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 35))
            buffer = io.BytesIO()
            img.convert('RGB').save(buffer, format='WEBP', quality=85)
            buffer.seek(0)
            return ContentFile(buffer.read(), name=f'placeholder_{index}.webp')

        def _get_image_file(index):
            existing = [p for p in test_images if os.path.isfile(os.path.join(os.getcwd(), p))]
            if existing:
                selected = existing[index % len(existing)]
                full_image_path = os.path.join(os.getcwd(), selected)
                with open(full_image_path, 'rb') as image_file:
                    return File(image_file, name=os.path.basename(full_image_path))

            return _generate_gradient_image(index)

        categories = [
            'Aesthetic Candles',
            'Decor',
            'Gift & Party Favors'    
        ]
        sub_categories = {
            'Aesthetic Candles': [
                'Greek Sculptures',
                'Love & Romance',
                'Minimalist Modern',
                'Cute Animals',
                'Flowers',
                'Holiday Glow',
                'New Arrivals'
            ],
            'Decor': [
                'Trending Now',
                'New Arrivals'
            ],
            'Gift & Party Favors': [
                "Valentine's Day",
                'Birthdays',
                'Wedding',
                'Christmas',
                "Mother's Day",
                'Gender Reveal & Baby Showers',
                'Trending Now'
            ]  
        }

        for _ in range(number_of_products):
            category = random.choice(categories)
            sub_category = random.choice(sub_categories[category])
            title = fake.word().capitalize()
            description  = fake.text(max_nb_chars=300)

            # Create a new gallery (library)
            gallery = Library.objects.create(title=title)

            # Add test images to the gallery
            for idx, _ in enumerate(test_images):
                upload = _get_image_file(idx)
                Attachment.objects.create(
                    library=gallery,
                    file=upload,
                    original_name=getattr(upload, 'name', f'placeholder_{idx}.webp'),
                    rank=0,
                )

            new_product = Product.objects.create(
                category=category + ' (EN)',
                sub_category=sub_category + ' (EN)',
                title=title + ' (EN)',
                description=description + ' (EN)',
                price=fake.random_int(min=100, max=190),
                gallery=gallery,
            )

            self.stdout.write(self.style.SUCCESS(f'Product "{new_product}" created'))

        self.stdout.write(self.style.SUCCESS(f'"{Product.objects.count()}" Product records created'))